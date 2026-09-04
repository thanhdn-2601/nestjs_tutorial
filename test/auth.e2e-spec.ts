import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { Repository } from 'typeorm';
import { validationExceptionFactory } from './../src/common/validation-exception-factory';
import { AppModule } from './../src/app.module';
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
  });

  afterAll(async () => {
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
