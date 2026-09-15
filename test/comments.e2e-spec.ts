import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource, Repository } from 'typeorm';
import { validationExceptionFactory } from './../src/common/validation-exception-factory';
import { Article } from './../src/articles/article.entity';
import { AppModule } from './../src/app.module';
import { Comment } from './../src/comments/comment.entity';
import { User } from './../src/users/user.entity';
import { truncateAllTables } from './utils/database-cleaner';
import {
  seedArticle,
  seedComment,
  seedUser,
  signAccessToken,
} from './utils/fixtures';

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

describe('Comments (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let jwtService: JwtService;
  let usersRepository: Repository<User>;
  let articlesRepository: Repository<Article>;
  let commentsRepository: Repository<Comment>;

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

    dataSource = moduleFixture.get(DataSource);
    jwtService = moduleFixture.get(JwtService);
    usersRepository = moduleFixture.get<Repository<User>>(
      getRepositoryToken(User),
    );
    articlesRepository = moduleFixture.get<Repository<Article>>(
      getRepositoryToken(Article),
    );
    commentsRepository = moduleFixture.get<Repository<Comment>>(
      getRepositoryToken(Comment),
    );
  });

  afterEach(async () => {
    await truncateAllTables(dataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /articles/:slug/comments', () => {
    it('creates a comment authored by the caller and persists it', async () => {
      const author = await seedUser(usersRepository);
      const commenter = await seedUser(usersRepository);
      const article = await seedArticle(articlesRepository, author);
      const token = signAccessToken(jwtService, commenter);

      const res = await request(app.getHttpServer())
        .post(`/articles/${article.slug}/comments`)
        .set('Authorization', `Token ${token}`)
        .send({ comment: { body: 'Great article, thanks!' } })
        .expect(201);

      const body = res.body as CommentResponseBody;
      expect(body.comment).toMatchObject({
        body: 'Great article, thanks!',
        author: { username: commenter.username, following: false },
      });
      expect(body.comment.id).toEqual(expect.any(Number));

      const stored = await commentsRepository.findOne({
        where: { articleId: article.id },
      });
      expect(stored?.authorId).toBe(commenter.id);
      expect(stored?.body).toBe('Great article, thanks!');
    });

    it('returns 401 without a token', async () => {
      const author = await seedUser(usersRepository);
      const article = await seedArticle(articlesRepository, author);

      await request(app.getHttpServer())
        .post(`/articles/${article.slug}/comments`)
        .send({ comment: { body: 'nice' } })
        .expect(401);
    });

    it('returns 404 when the article does not exist', async () => {
      const commenter = await seedUser(usersRepository);
      const token = signAccessToken(jwtService, commenter);

      const res = await request(app.getHttpServer())
        .post('/articles/no-such-slug-xyz/comments')
        .set('Authorization', `Token ${token}`)
        .send({ comment: { body: 'nice' } })
        .expect(404);

      expect((res.body as ErrorsResponseBody).errors.slug).toContain(
        'was not found',
      );
    });

    it('returns 422 for a whitespace-only body', async () => {
      const author = await seedUser(usersRepository);
      const article = await seedArticle(articlesRepository, author);
      const token = signAccessToken(jwtService, author);

      const res = await request(app.getHttpServer())
        .post(`/articles/${article.slug}/comments`)
        .set('Authorization', `Token ${token}`)
        .send({ comment: { body: '   ' } })
        .expect(422);

      expect((res.body as ErrorsResponseBody).errors.body).toContain(
        'body should not be empty',
      );
    });
  });

  describe('GET /articles/:slug/comments', () => {
    it('returns comments newest-first', async () => {
      const author = await seedUser(usersRepository);
      const reader = await seedUser(usersRepository);
      const article = await seedArticle(articlesRepository, author);
      const first = await seedComment(commentsRepository, article, author, {
        body: 'first comment',
      });
      const second = await seedComment(commentsRepository, article, reader, {
        body: 'second comment',
      });

      const res = await request(app.getHttpServer())
        .get(`/articles/${article.slug}/comments`)
        .expect(200);

      const body = res.body as CommentsResponseBody;
      expect(body.comments.map((c) => c.id)).toEqual([second.id, first.id]);
      expect(body.comments.every((c) => c.author.following === false)).toBe(
        true,
      );
    });

    it('reflects the following flag for the authenticated caller', async () => {
      const author = await seedUser(usersRepository);
      const reader = await seedUser(usersRepository);
      const article = await seedArticle(articlesRepository, author);
      await seedComment(commentsRepository, article, author);
      const readerToken = signAccessToken(jwtService, reader);

      await request(app.getHttpServer())
        .post(`/profiles/${author.username}/follow`)
        .set('Authorization', `Token ${readerToken}`)
        .expect(201);

      const res = await request(app.getHttpServer())
        .get(`/articles/${article.slug}/comments`)
        .set('Authorization', `Token ${readerToken}`)
        .expect(200);

      const body = res.body as CommentsResponseBody;
      expect(body.comments[0].author.following).toBe(true);
    });

    it('returns an empty list for an article with no comments', async () => {
      const author = await seedUser(usersRepository);
      const article = await seedArticle(articlesRepository, author);

      const res = await request(app.getHttpServer())
        .get(`/articles/${article.slug}/comments`)
        .expect(200);

      expect((res.body as CommentsResponseBody).comments).toEqual([]);
    });

    it('returns 404 for a slug that does not exist', () => {
      return request(app.getHttpServer())
        .get('/articles/no-such-slug-xyz/comments')
        .expect(404);
    });
  });

  describe('DELETE /articles/:slug/comments/:id', () => {
    it("deletes the caller's own comment", async () => {
      const author = await seedUser(usersRepository);
      const article = await seedArticle(articlesRepository, author);
      const comment = await seedComment(commentsRepository, article, author);
      const token = signAccessToken(jwtService, author);

      await request(app.getHttpServer())
        .delete(`/articles/${article.slug}/comments/${comment.id}`)
        .set('Authorization', `Token ${token}`)
        .expect(204);

      expect(
        await commentsRepository.findOne({ where: { id: comment.id } }),
      ).toBeNull();

      const res = await request(app.getHttpServer())
        .get(`/articles/${article.slug}/comments`)
        .expect(200);
      expect(
        (res.body as CommentsResponseBody).comments.map((c) => c.id),
      ).not.toContain(comment.id);
    });

    it('returns 401 without a token', async () => {
      const author = await seedUser(usersRepository);
      const article = await seedArticle(articlesRepository, author);
      const comment = await seedComment(commentsRepository, article, author);

      await request(app.getHttpServer())
        .delete(`/articles/${article.slug}/comments/${comment.id}`)
        .expect(401);
    });

    it('returns 403 when the caller is not the comment author', async () => {
      const author = await seedUser(usersRepository);
      const other = await seedUser(usersRepository);
      const article = await seedArticle(articlesRepository, author);
      const comment = await seedComment(commentsRepository, article, author);
      const otherToken = signAccessToken(jwtService, other);

      const res = await request(app.getHttpServer())
        .delete(`/articles/${article.slug}/comments/${comment.id}`)
        .set('Authorization', `Token ${otherToken}`)
        .expect(403);

      expect((res.body as ErrorsResponseBody).errors.comment).toContain(
        'you are not the author of this comment',
      );

      expect(
        await commentsRepository.findOne({ where: { id: comment.id } }),
      ).not.toBeNull();
    });

    it('returns 404 for a comment id that does not exist', async () => {
      const author = await seedUser(usersRepository);
      const article = await seedArticle(articlesRepository, author);
      const token = signAccessToken(jwtService, author);

      await request(app.getHttpServer())
        .delete(`/articles/${article.slug}/comments/999999999`)
        .set('Authorization', `Token ${token}`)
        .expect(404);
    });

    it('returns 404 (not a silent id coercion) for a non-numeric id', async () => {
      const author = await seedUser(usersRepository);
      const article = await seedArticle(articlesRepository, author);
      const comment = await seedComment(commentsRepository, article, author);
      const token = signAccessToken(jwtService, author);

      await request(app.getHttpServer())
        .delete(
          `/articles/${article.slug}/comments/0x${comment.id.toString(16)}`,
        )
        .set('Authorization', `Token ${token}`)
        .expect(404);

      expect(
        await commentsRepository.findOne({ where: { id: comment.id } }),
      ).not.toBeNull();
    });

    it('returns 404 when the comment belongs to a different article', async () => {
      const author = await seedUser(usersRepository);
      const articleA = await seedArticle(articlesRepository, author);
      const articleB = await seedArticle(articlesRepository, author);
      const comment = await seedComment(commentsRepository, articleA, author);
      const token = signAccessToken(jwtService, author);

      await request(app.getHttpServer())
        .delete(`/articles/${articleB.slug}/comments/${comment.id}`)
        .set('Authorization', `Token ${token}`)
        .expect(404);

      expect(
        await commentsRepository.findOne({ where: { id: comment.id } }),
      ).not.toBeNull();
    });
  });
});
