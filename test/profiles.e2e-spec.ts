import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { Repository } from 'typeorm';
import { validationExceptionFactory } from './../src/common/validation-exception-factory';
import { AppModule } from './../src/app.module';
import { Follow } from './../src/profiles/follow.entity';
import { User } from './../src/users/user.entity';

interface ErrorsResponseBody {
  errors: Record<string, string[]>;
}

interface ProfileResponseBody {
  profile: {
    username: string;
    bio: string;
    image: string | null;
    following: boolean;
  };
}

interface UserResponseBody {
  user: { token: string };
}

describe('Profiles (e2e)', () => {
  let app: INestApplication<App>;
  let usersRepository: Repository<User>;
  let followsRepository: Repository<Follow>;

  const password = 'password123';
  const followerEmail = `e2e_follower_${Date.now()}@example.com`;
  const followerUsername = `e2e_follower_${Date.now()}`;
  const followeeEmail = `e2e_followee_${Date.now()}@example.com`;
  const followeeUsername = `e2e_followee_${Date.now()}`;

  let followerToken: string;
  let followerId: number;
  let followeeId: number;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        exceptionFactory: validationExceptionFactory,
      }),
    );
    await app.init();

    usersRepository = moduleFixture.get<Repository<User>>(
      getRepositoryToken(User),
    );
    followsRepository = moduleFixture.get<Repository<Follow>>(
      getRepositoryToken(Follow),
    );

    const [followerRes] = await Promise.all([
      request(app.getHttpServer())
        .post('/users')
        .send({
          user: {
            username: followerUsername,
            email: followerEmail,
            password,
          },
        }),
      request(app.getHttpServer())
        .post('/users')
        .send({
          user: {
            username: followeeUsername,
            email: followeeEmail,
            password,
          },
        }),
    ]);
    followerToken = (followerRes.body as UserResponseBody).user.token;

    const [follower, followee] = await Promise.all([
      usersRepository.findOneOrFail({ where: { email: followerEmail } }),
      usersRepository.findOneOrFail({ where: { email: followeeEmail } }),
    ]);
    followerId = follower.id;
    followeeId = followee.id;
  });

  afterAll(async () => {
    // follows rows cascade-delete via the users FK, no separate cleanup needed
    await usersRepository.delete({ email: followerEmail });
    await usersRepository.delete({ email: followeeEmail });
    await app.close();
  });

  describe('GET /profiles/:username', () => {
    it('returns 404 for a username that does not exist', () => {
      return request(app.getHttpServer())
        .get('/profiles/no_such_user_xyz')
        .expect(404)
        .expect((res) => {
          const body = res.body as ErrorsResponseBody;
          expect(body.errors.username).toContain('was not found');
        });
    });

    it('returns following:false for an anonymous request', () => {
      return request(app.getHttpServer())
        .get(`/profiles/${followeeUsername}`)
        .expect(200)
        .expect((res) => {
          const body = res.body as ProfileResponseBody;
          expect(body.profile.username).toBe(followeeUsername);
          expect(body.profile.following).toBe(false);
        });
    });

    it('returns following:false for an authenticated user who does not follow yet', () => {
      return request(app.getHttpServer())
        .get(`/profiles/${followeeUsername}`)
        .set('Authorization', `Token ${followerToken}`)
        .expect(200)
        .expect((res) => {
          const body = res.body as ProfileResponseBody;
          expect(body.profile.following).toBe(false);
        });
    });

    it('returns 401 for a token that has been logged out, instead of silently falling back to anonymous', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/users/login')
        .send({ user: { email: followerEmail, password } });
      const staleToken = (loginRes.body as UserResponseBody).user.token;

      await request(app.getHttpServer())
        .post('/user/logout')
        .set('Authorization', `Token ${staleToken}`)
        .expect(204);

      await request(app.getHttpServer())
        .get(`/profiles/${followeeUsername}`)
        .set('Authorization', `Token ${staleToken}`)
        .expect(401);
    });
  });

  describe('POST /profiles/:username/follow', () => {
    it('returns 401 without a token', () => {
      return request(app.getHttpServer())
        .post(`/profiles/${followeeUsername}/follow`)
        .expect(401);
    });

    it('returns 404 for a username that does not exist', () => {
      return request(app.getHttpServer())
        .post('/profiles/no_such_user_xyz/follow')
        .set('Authorization', `Token ${followerToken}`)
        .expect(404);
    });

    it('returns 422 when trying to follow yourself', () => {
      return request(app.getHttpServer())
        .post(`/profiles/${followerUsername}/follow`)
        .set('Authorization', `Token ${followerToken}`)
        .expect(422)
        .expect((res) => {
          const body = res.body as ErrorsResponseBody;
          expect(body.errors.username).toContain('cannot follow yourself');
        });
    });

    it('follows the user and is idempotent on a second call', async () => {
      await request(app.getHttpServer())
        .post(`/profiles/${followeeUsername}/follow`)
        .set('Authorization', `Token ${followerToken}`)
        .expect(201)
        .expect((res) => {
          const body = res.body as ProfileResponseBody;
          expect(body.profile.following).toBe(true);
        });

      await request(app.getHttpServer())
        .post(`/profiles/${followeeUsername}/follow`)
        .set('Authorization', `Token ${followerToken}`)
        .expect(201)
        .expect((res) => {
          const body = res.body as ProfileResponseBody;
          expect(body.profile.following).toBe(true);
        });

      const followRows = await followsRepository.find({
        where: { followerId, followeeId },
      });
      expect(followRows).toHaveLength(1);
    });
  });

  describe('DELETE /profiles/:username/follow', () => {
    it('returns 401 without a token', () => {
      return request(app.getHttpServer())
        .delete(`/profiles/${followeeUsername}/follow`)
        .expect(401);
    });

    it('unfollows the user and is idempotent when not following', async () => {
      await request(app.getHttpServer())
        .delete(`/profiles/${followeeUsername}/follow`)
        .set('Authorization', `Token ${followerToken}`)
        .expect(200)
        .expect((res) => {
          const body = res.body as ProfileResponseBody;
          expect(body.profile.following).toBe(false);
        });

      await request(app.getHttpServer())
        .delete(`/profiles/${followeeUsername}/follow`)
        .set('Authorization', `Token ${followerToken}`)
        .expect(200)
        .expect((res) => {
          const body = res.body as ProfileResponseBody;
          expect(body.profile.following).toBe(false);
        });
    });
  });
});
