import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { access, unlink } from 'fs/promises';
import { join } from 'path';
import request from 'supertest';
import { App } from 'supertest/types';
import { Repository } from 'typeorm';
import { validationExceptionFactory } from './../src/common/validation-exception-factory';
import { AppModule } from './../src/app.module';
import {
  AttachableType,
  Attachment,
} from './../src/attachments/attachment.entity';
import { User } from './../src/users/user.entity';

interface ErrorsResponseBody {
  errors: Record<string, string[]>;
}

interface UserResponseBody {
  user: {
    email: string;
    username: string;
    token: string;
    bio: string;
    image: string | null;
  };
}

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let usersRepository: Repository<User>;
  let attachmentsRepository: Repository<Attachment>;

  const testEmail = `e2e_${Date.now()}@example.com`;
  const testUsername = `e2e_user_${Date.now()}`;
  const password = 'password123';

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
    attachmentsRepository = moduleFixture.get<Repository<Attachment>>(
      getRepositoryToken(Attachment),
    );
  });

  afterAll(async () => {
    const testUser = await usersRepository.findOne({
      where: { email: testEmail },
    });
    if (testUser) {
      await attachmentsRepository.delete({
        attachableType: AttachableType.USER,
        attachableId: testUser.id,
      });
    }
    await usersRepository.delete({ email: testEmail });
    await app.close();
  });

  describe('/users (POST)', () => {
    it('returns 422 with validation errors for an empty payload', () => {
      return request(app.getHttpServer())
        .post('/users')
        .send({ user: {} })
        .expect(422)
        .expect((res) => {
          const body = res.body as ErrorsResponseBody;
          expect(body.errors.username).toContain(
            'username should not be empty',
          );
          expect(body.errors.email).toContain('email should not be empty');
          expect(body.errors.password).toContain(
            'password should not be empty',
          );
        });
    });

    it('registers a new user', () => {
      return request(app.getHttpServer())
        .post('/users')
        .send({
          user: { username: testUsername, email: testEmail, password },
        })
        .expect(201)
        .expect((res) => {
          const body = res.body as UserResponseBody;
          expect(body.user.email).toBe(testEmail);
          expect(body.user.username).toBe(testUsername);
          expect(body.user.token).toEqual(expect.any(String));
          expect(
            (body.user as Record<string, unknown>).password,
          ).toBeUndefined();
        });
    });

    it('returns 422 when the email is already taken', () => {
      return request(app.getHttpServer())
        .post('/users')
        .send({
          user: {
            username: `${testUsername}_2`,
            email: testEmail,
            password,
          },
        })
        .expect(422)
        .expect((res) => {
          const body = res.body as ErrorsResponseBody;
          expect(body.errors.email).toContain('has already been taken');
        });
    });
  });

  describe('/users/login (POST)', () => {
    it('returns 401 for a wrong password', () => {
      return request(app.getHttpServer())
        .post('/users/login')
        .send({ user: { email: testEmail, password: 'wrong-password' } })
        .expect(401)
        .expect((res) => {
          const body = res.body as ErrorsResponseBody;
          expect(body.errors.password).toContain('is invalid');
        });
    });

    it('returns 401 for an email that does not exist', () => {
      return request(app.getHttpServer())
        .post('/users/login')
        .send({ user: { email: 'no-such-user@example.com', password } })
        .expect(401)
        .expect((res) => {
          const body = res.body as ErrorsResponseBody;
          expect(body.errors.email).toContain('was not found');
        });
    });

    it('logs in and returns a token', () => {
      return request(app.getHttpServer())
        .post('/users/login')
        .send({ user: { email: testEmail, password } })
        .expect(201)
        .expect((res) => {
          const body = res.body as UserResponseBody;
          expect(body.user.email).toBe(testEmail);
          expect(body.user.token).toEqual(expect.any(String));
        });
    });
  });

  describe('/user (GET)', () => {
    let token: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/users/login')
        .send({ user: { email: testEmail, password } });
      token = (res.body as UserResponseBody).user.token;
    });

    it('returns 401 without a token', () => {
      return request(app.getHttpServer()).get('/user').expect(401);
    });

    it('returns the current user for a valid token', () => {
      return request(app.getHttpServer())
        .get('/user')
        .set('Authorization', `Token ${token}`)
        .expect(200)
        .expect((res) => {
          const body = res.body as UserResponseBody;
          expect(body.user.email).toBe(testEmail);
          expect(body.user.username).toBe(testUsername);
        });
    });
  });

  describe('/user (PUT)', () => {
    let token: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/users/login')
        .send({ user: { email: testEmail, password } });
      token = (res.body as UserResponseBody).user.token;
    });

    it('returns 401 without a token', () => {
      return request(app.getHttpServer()).put('/user').expect(401);
    });

    it('updates the bio', () => {
      return request(app.getHttpServer())
        .put('/user')
        .set('Authorization', `Token ${token}`)
        .send({ user: { bio: 'updated bio' } })
        .expect(200)
        .expect((res) => {
          const body = res.body as UserResponseBody & { user: { bio: string } };
          expect(body.user.bio).toBe('updated bio');
          expect(body.user.email).toBe(testEmail);
        });
    });

    it('returns 422 when the email is already taken by another user', async () => {
      const otherEmail = `e2e_other_${Date.now()}@example.com`;
      await request(app.getHttpServer())
        .post('/users')
        .send({
          user: {
            username: `e2e_other_${Date.now()}`,
            email: otherEmail,
            password,
          },
        });

      await request(app.getHttpServer())
        .put('/user')
        .set('Authorization', `Token ${token}`)
        .send({ user: { email: otherEmail } })
        .expect(422)
        .expect((res) => {
          const body = res.body as ErrorsResponseBody;
          expect(body.errors.email).toContain('has already been taken');
        });

      await usersRepository.delete({ email: otherEmail });
    });

    it('returns 422 for an empty username instead of blanking it out', async () => {
      await request(app.getHttpServer())
        .put('/user')
        .set('Authorization', `Token ${token}`)
        .send({ user: { username: '' } })
        .expect(422)
        .expect((res) => {
          const body = res.body as ErrorsResponseBody;
          expect(body.errors.username).toContain(
            'username should not be empty',
          );
        });

      const res = await request(app.getHttpServer())
        .get('/user')
        .set('Authorization', `Token ${token}`);
      expect((res.body as UserResponseBody).user.username).toBe(testUsername);
    });
  });

  describe('/user/avatar (POST)', () => {
    let token: string;
    let userId: number;
    const pngBuffer = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
    const uploadedPaths: string[] = [];

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/users/login')
        .send({ user: { email: testEmail, password } });
      token = (res.body as UserResponseBody).user.token;
      const testUser = await usersRepository.findOneOrFail({
        where: { email: testEmail },
      });
      userId = testUser.id;
    });

    afterAll(async () => {
      await Promise.all(
        uploadedPaths.map((imageUrl) =>
          unlink(join(process.cwd(), 'public', imageUrl)).catch(
            () => undefined,
          ),
        ),
      );
    });

    it('returns 401 without a token', () => {
      return request(app.getHttpServer())
        .post('/user/avatar')
        .attach('avatar', pngBuffer, {
          filename: 'avatar.png',
          contentType: 'image/png',
        })
        .expect(401);
    });

    it('rejects a non-image file', () => {
      return request(app.getHttpServer())
        .post('/user/avatar')
        .set('Authorization', `Token ${token}`)
        .attach('avatar', Buffer.from('not an image'), {
          filename: 'file.txt',
          contentType: 'text/plain',
        })
        .expect(400);
    });

    it('uploads an avatar and updates the image url', () => {
      return request(app.getHttpServer())
        .post('/user/avatar')
        .set('Authorization', `Token ${token}`)
        .attach('avatar', pngBuffer, {
          filename: 'avatar.png',
          contentType: 'image/png',
        })
        .expect(201)
        .expect((res) => {
          const body = res.body as UserResponseBody;
          expect(body.user.image).toMatch(/^\/uploads\/avatars\/.+\.png$/);
          uploadedPaths.push(body.user.image as string);
        });
    });

    it('handles concurrent uploads without leaving a broken image reference', async () => {
      const responses = await Promise.all(
        [0, 1, 2, 3, 4].map((n) =>
          request(app.getHttpServer())
            .post('/user/avatar')
            .set('Authorization', `Token ${token}`)
            .attach('avatar', Buffer.concat([pngBuffer, Buffer.from([n])]), {
              filename: `race-${n}.png`,
              contentType: 'image/png',
            }),
        ),
      );
      responses.forEach((res) => expect(res.status).toBe(201));

      const finalRes = await request(app.getHttpServer())
        .get('/user')
        .set('Authorization', `Token ${token}`);
      const finalImage = (finalRes.body as UserResponseBody).user
        .image as string;
      uploadedPaths.push(finalImage);

      // The file the user now references must actually exist on disk. (Not
      // asserted via an HTTP GET through ServeStaticModule: that middleware is
      // wired up in Nest's onModuleInit phase, which — only under ts-jest/ts-node,
      // not in a real compiled/running app — registers after this app's request
      // handling is already active, making the route unreliable in this harness.)
      await access(join(process.cwd(), 'public', finalImage));

      // Exactly one attachment row should remain for this user, and it must
      // be the one currently referenced — not orphaned by a pruning race.
      const rows = await attachmentsRepository.find({
        where: { attachableType: AttachableType.USER, attachableId: userId },
      });
      expect(rows).toHaveLength(1);
      expect(rows[0].url).toBe(finalImage);
    });
  });

  describe('/user/logout (POST)', () => {
    let token: string;

    beforeEach(async () => {
      const res = await request(app.getHttpServer())
        .post('/users/login')
        .send({ user: { email: testEmail, password } });
      token = (res.body as UserResponseBody).user.token;
    });

    it('returns 401 without a token', () => {
      return request(app.getHttpServer()).post('/user/logout').expect(401);
    });

    it('blacklists the token so it can no longer be used', async () => {
      await request(app.getHttpServer())
        .post('/user/logout')
        .set('Authorization', `Token ${token}`)
        .expect(204);

      await request(app.getHttpServer())
        .get('/user')
        .set('Authorization', `Token ${token}`)
        .expect(401);
    });

    it('does not affect other, still-valid tokens', async () => {
      const other = await request(app.getHttpServer())
        .post('/users/login')
        .send({ user: { email: testEmail, password } });
      const otherToken = (other.body as UserResponseBody).user.token;

      await request(app.getHttpServer())
        .post('/user/logout')
        .set('Authorization', `Token ${token}`)
        .expect(204);

      await request(app.getHttpServer())
        .get('/user')
        .set('Authorization', `Token ${otherToken}`)
        .expect(200);
    });
  });
});
