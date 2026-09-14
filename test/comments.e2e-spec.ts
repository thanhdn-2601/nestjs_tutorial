import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { Repository } from 'typeorm';
import { validationExceptionFactory } from './../src/common/validation-exception-factory';
import { AppModule } from './../src/app.module';
import { Comment } from './../src/comments/comment.entity';
import { User } from './../src/users/user.entity';

interface ErrorsResponseBody {
  errors: Record<string, string[]>;
}

interface CommentResponseBody {
  comment: {
    id: number;
    createdAt: string;
    updatedAt: string;
    body: string;
    author: { username: string; following: boolean };
  };
}

interface CommentsResponseBody {
  comments: CommentResponseBody['comment'][];
}

interface UserResponseBody {
  user: { token: string };
}

interface ArticleResponseBody {
  article: { slug: string };
}

describe('Comments (e2e)', () => {
  let app: INestApplication<App>;
  let usersRepository: Repository<User>;
  let commentsRepository: Repository<Comment>;

  const password = 'password123';
  const authorEmail = `e2e_c_author_${Date.now()}@example.com`;
  const authorUsername = `e2e_c_author_${Date.now()}`;
  const otherEmail = `e2e_c_other_${Date.now()}@example.com`;
  const otherUsername = `e2e_c_other_${Date.now()}`;

  let authorToken: string;
  let otherToken: string;
  let slug: string;

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
    commentsRepository = moduleFixture.get<Repository<Comment>>(
      getRepositoryToken(Comment),
    );

    const [authorRes, otherRes] = await Promise.all([
      request(app.getHttpServer())
        .post('/users')
        .send({
          user: { username: authorUsername, email: authorEmail, password },
        }),
      request(app.getHttpServer())
        .post('/users')
        .send({
          user: { username: otherUsername, email: otherEmail, password },
        }),
    ]);
    authorToken = (authorRes.body as UserResponseBody).user.token;
    otherToken = (otherRes.body as UserResponseBody).user.token;

    const articleRes = await request(app.getHttpServer())
      .post('/articles')
      .set('Authorization', `Token ${authorToken}`)
      .send({
        article: {
          title: `Comment Fixture ${Date.now()}`,
          description: 'd',
          body: 'b',
        },
      });
    slug = (articleRes.body as ArticleResponseBody).article.slug;
  });

  afterAll(async () => {
    // comments cascade-delete via the users FK
    await usersRepository.delete({ email: authorEmail });
    await usersRepository.delete({ email: otherEmail });
    await app.close();
  });

  describe('POST /articles/:slug/comments', () => {
    it('returns 401 without a token', () => {
      return request(app.getHttpServer())
        .post(`/articles/${slug}/comments`)
        .send({ comment: { body: 'nice article' } })
        .expect(401);
    });

    it('returns 404 for a slug that does not exist', () => {
      return request(app.getHttpServer())
        .post('/articles/no-such-slug-xyz/comments')
        .set('Authorization', `Token ${authorToken}`)
        .send({ comment: { body: 'nice article' } })
        .expect(404)
        .expect((res) => {
          const body = res.body as ErrorsResponseBody;
          expect(body.errors.slug).toContain('was not found');
        });
    });

    it('returns 422 for an empty body', () => {
      return request(app.getHttpServer())
        .post(`/articles/${slug}/comments`)
        .set('Authorization', `Token ${authorToken}`)
        .send({ comment: { body: '   ' } })
        .expect(422)
        .expect((res) => {
          const body = res.body as ErrorsResponseBody;
          expect(body.errors.body).toContain('body should not be empty');
        });
    });

    it('creates a comment authored by the caller', () => {
      return request(app.getHttpServer())
        .post(`/articles/${slug}/comments`)
        .set('Authorization', `Token ${otherToken}`)
        .send({ comment: { body: 'Great read, thanks!' } })
        .expect(201)
        .expect((res) => {
          const body = res.body as CommentResponseBody;
          expect(body.comment.body).toBe('Great read, thanks!');
          expect(body.comment.author.username).toBe(otherUsername);
          expect(body.comment.id).toEqual(expect.any(Number));
        });
    });
  });

  describe('with existing comments', () => {
    let authorCommentId: number;
    let otherCommentId: number;

    beforeAll(async () => {
      const [authorRes, otherRes] = await Promise.all([
        request(app.getHttpServer())
          .post(`/articles/${slug}/comments`)
          .set('Authorization', `Token ${authorToken}`)
          .send({ comment: { body: 'From the author' } }),
        request(app.getHttpServer())
          .post(`/articles/${slug}/comments`)
          .set('Authorization', `Token ${otherToken}`)
          .send({ comment: { body: 'From the other user' } }),
      ]);
      authorCommentId = (authorRes.body as CommentResponseBody).comment.id;
      otherCommentId = (otherRes.body as CommentResponseBody).comment.id;
    });

    describe('GET /articles/:slug/comments', () => {
      it('returns 404 for a slug that does not exist', () => {
        return request(app.getHttpServer())
          .get('/articles/no-such-slug-xyz/comments')
          .expect(404);
      });

      it('lists comments for an anonymous request', () => {
        return request(app.getHttpServer())
          .get(`/articles/${slug}/comments`)
          .expect(200)
          .expect((res) => {
            const body = res.body as CommentsResponseBody;
            expect(body.comments.length).toBeGreaterThanOrEqual(2);
            const ids = body.comments.map((comment) => comment.id);
            expect(ids).toContain(authorCommentId);
            expect(ids).toContain(otherCommentId);
            expect(
              body.comments.every(
                (comment) => comment.author.following === false,
              ),
            ).toBe(true);
          });
      });

      it('reflects the following flag for an authenticated request', async () => {
        await request(app.getHttpServer())
          .post(`/profiles/${authorUsername}/follow`)
          .set('Authorization', `Token ${otherToken}`);

        const res = await request(app.getHttpServer())
          .get(`/articles/${slug}/comments`)
          .set('Authorization', `Token ${otherToken}`)
          .expect(200);
        const body = res.body as CommentsResponseBody;
        const authorComment = body.comments.find(
          (comment) => comment.id === authorCommentId,
        );
        expect(authorComment?.author.following).toBe(true);

        await request(app.getHttpServer())
          .delete(`/profiles/${authorUsername}/follow`)
          .set('Authorization', `Token ${otherToken}`);
      });
    });

    describe('DELETE /articles/:slug/comments/:id', () => {
      it('returns 401 without a token', () => {
        return request(app.getHttpServer())
          .delete(`/articles/${slug}/comments/${otherCommentId}`)
          .expect(401);
      });

      it('returns 404 for a comment id that does not exist', () => {
        return request(app.getHttpServer())
          .delete(`/articles/${slug}/comments/999999999`)
          .set('Authorization', `Token ${otherToken}`)
          .expect(404);
      });

      it('returns 404 (not a silent id coercion) for a non-numeric id', () => {
        return request(app.getHttpServer())
          .delete(`/articles/${slug}/comments/0x1`)
          .set('Authorization', `Token ${otherToken}`)
          .expect(404);
      });

      it('returns 403 when the caller is not the comment author', () => {
        return request(app.getHttpServer())
          .delete(`/articles/${slug}/comments/${otherCommentId}`)
          .set('Authorization', `Token ${authorToken}`)
          .expect(403)
          .expect((res) => {
            const body = res.body as ErrorsResponseBody;
            expect(body.errors.comment).toContain(
              'you are not the author of this comment',
            );
          });
      });

      it("deletes the caller's own comment", async () => {
        await request(app.getHttpServer())
          .delete(`/articles/${slug}/comments/${otherCommentId}`)
          .set('Authorization', `Token ${otherToken}`)
          .expect(204);

        const remaining = await commentsRepository.findOne({
          where: { id: otherCommentId },
        });
        expect(remaining).toBeNull();

        const res = await request(app.getHttpServer()).get(
          `/articles/${slug}/comments`,
        );
        const body = res.body as CommentsResponseBody;
        expect(body.comments.map((comment) => comment.id)).not.toContain(
          otherCommentId,
        );
      });
    });
  });
});
