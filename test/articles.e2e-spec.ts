import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { Repository } from 'typeorm';
import { validationExceptionFactory } from './../src/common/validation-exception-factory';
import { Article } from './../src/articles/article.entity';
import { AppModule } from './../src/app.module';
import { User } from './../src/users/user.entity';

interface ErrorsResponseBody {
  errors: Record<string, string[]>;
}

interface ArticleResponseBody {
  article: {
    slug: string;
    title: string;
    description: string;
    body: string;
    tagList: string[];
    favorited: boolean;
    favoritesCount: number;
    author: { username: string; following: boolean };
  };
}

interface ArticlesResponseBody {
  articles: ArticleResponseBody['article'][];
  articlesCount: number;
}

interface UserResponseBody {
  user: { token: string };
}

describe('Articles (e2e)', () => {
  let app: INestApplication<App>;
  let usersRepository: Repository<User>;
  let articlesRepository: Repository<Article>;

  const password = 'password123';
  const authorEmail = `e2e_author_${Date.now()}@example.com`;
  const authorUsername = `e2e_author_${Date.now()}`;
  const otherEmail = `e2e_other_${Date.now()}@example.com`;
  const otherUsername = `e2e_other_${Date.now()}`;

  let authorToken: string;
  let otherToken: string;

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
    articlesRepository = moduleFixture.get<Repository<Article>>(
      getRepositoryToken(Article),
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
  });

  afterAll(async () => {
    // articles/tags/favorites cascade-delete via the users FK
    await usersRepository.delete({ email: authorEmail });
    await usersRepository.delete({ email: otherEmail });
    await app.close();
  });

  describe('POST /articles', () => {
    it('returns 401 without a token', () => {
      return request(app.getHttpServer())
        .post('/articles')
        .send({ article: { title: 't', description: 'd', body: 'b' } })
        .expect(401);
    });

    it('returns 422 with validation errors for an empty payload', () => {
      return request(app.getHttpServer())
        .post('/articles')
        .set('Authorization', `Token ${authorToken}`)
        .send({ article: {} })
        .expect(422)
        .expect((res) => {
          const body = res.body as ErrorsResponseBody;
          expect(body.errors.title).toContain('title should not be empty');
          expect(body.errors.description).toContain(
            'description should not be empty',
          );
          expect(body.errors.body).toContain('body should not be empty');
        });
    });

    it('returns 422 for a whitespace-only title instead of blanking the slug prefix', () => {
      return request(app.getHttpServer())
        .post('/articles')
        .set('Authorization', `Token ${authorToken}`)
        .send({
          article: { title: '   ', description: 'd', body: 'b' },
        })
        .expect(422)
        .expect((res) => {
          const body = res.body as ErrorsResponseBody;
          expect(body.errors.title).toContain('title should not be empty');
        });
    });

    it('returns 422 (not a 500 crash) when a required field is explicitly null', () => {
      return request(app.getHttpServer())
        .post('/articles')
        .set('Authorization', `Token ${authorToken}`)
        .send({ article: { title: null, description: 'd', body: 'b' } })
        .expect(422)
        .expect((res) => {
          const body = res.body as ErrorsResponseBody;
          expect(body.errors.title).toContain('title should not be empty');
        });
    });

    it('slugifies a Vietnamese title into readable ASCII', () => {
      return request(app.getHttpServer())
        .post('/articles')
        .set('Authorization', `Token ${authorToken}`)
        .send({
          article: {
            title: 'Đường phố Đà Lạt',
            description: 'd',
            body: 'b',
          },
        })
        .expect(201)
        .expect((res) => {
          const body = res.body as ArticleResponseBody;
          expect(body.article.slug).toMatch(/^duong-pho-da-lat-/);
        });
    });

    it("creates an article with a slug, dedup'd tags, and the author profile", () => {
      return request(app.getHttpServer())
        .post('/articles')
        .set('Authorization', `Token ${authorToken}`)
        .send({
          article: {
            title: 'How to train your dragon',
            description: 'Ever wonder how?',
            body: 'It takes a Jacobian',
            tagList: ['dragons', 'training', 'dragons'],
          },
        })
        .expect(201)
        .expect((res) => {
          const body = res.body as ArticleResponseBody;
          expect(body.article.slug).toMatch(/^how-to-train-your-dragon-/);
          expect(body.article.tagList).toEqual(['dragons', 'training']);
          expect(body.article.favorited).toBe(false);
          expect(body.article.favoritesCount).toBe(0);
          expect(body.article.author.username).toBe(authorUsername);
        });
    });
  });

  describe('with an existing article', () => {
    let slug: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/articles')
        .set('Authorization', `Token ${authorToken}`)
        .send({
          article: {
            title: `Fixture Article ${Date.now()}`,
            description: 'desc',
            body: 'body',
            tagList: ['fixture'],
          },
        });
      slug = (res.body as ArticleResponseBody).article.slug;
    });

    describe('GET /articles/:slug', () => {
      it('returns 404 for a slug that does not exist', () => {
        return request(app.getHttpServer())
          .get('/articles/no-such-slug-xyz')
          .expect(404)
          .expect((res) => {
            const body = res.body as ErrorsResponseBody;
            expect(body.errors.slug).toContain('was not found');
          });
      });

      it('returns the article for an anonymous request', () => {
        return request(app.getHttpServer())
          .get(`/articles/${slug}`)
          .expect(200)
          .expect((res) => {
            const body = res.body as ArticleResponseBody;
            expect(body.article.slug).toBe(slug);
          });
      });
    });

    describe('GET /articles', () => {
      it('lists articles including the fixture, most recent first', () => {
        return request(app.getHttpServer())
          .get('/articles')
          .expect(200)
          .expect((res) => {
            const body = res.body as ArticlesResponseBody;
            expect(body.articles.some((a) => a.slug === slug)).toBe(true);
            expect(body.articlesCount).toBeGreaterThanOrEqual(1);
          });
      });

      it('filters by tag', async () => {
        const matching = await request(app.getHttpServer()).get(
          '/articles?tag=fixture',
        );
        const matchingBody = matching.body as ArticlesResponseBody;
        expect(matchingBody.articles.map((a) => a.slug)).toEqual([slug]);

        const notMatching = await request(app.getHttpServer()).get(
          '/articles?tag=no-such-tag-xyz',
        );
        expect((notMatching.body as ArticlesResponseBody).articles).toEqual([]);
      });

      it('filters by author', () => {
        return request(app.getHttpServer())
          .get(`/articles?author=${authorUsername}`)
          .expect(200)
          .expect((res) => {
            const body = res.body as ArticlesResponseBody;
            expect(body.articles.some((a) => a.slug === slug)).toBe(true);
          });
      });

      it('returns an empty list for an author that does not exist', () => {
        return request(app.getHttpServer())
          .get('/articles?author=no_such_user_xyz')
          .expect(200)
          .expect((res) => {
            const body = res.body as ArticlesResponseBody;
            expect(body.articles).toEqual([]);
            expect(body.articlesCount).toBe(0);
          });
      });

      it('rejects a limit above the allowed maximum', () => {
        return request(app.getHttpServer())
          .get('/articles?limit=1000000')
          .expect(422)
          .expect((res) => {
            const body = res.body as ErrorsResponseBody;
            expect(body.errors.limit).toContain(
              'limit must not be greater than 100',
            );
          });
      });
    });

    describe('PUT /articles/:slug', () => {
      it('returns 401 without a token', () => {
        return request(app.getHttpServer())
          .put(`/articles/${slug}`)
          .send({ article: { title: 'x' } })
          .expect(401);
      });

      it("returns 403 when the caller is not the article's author", () => {
        return request(app.getHttpServer())
          .put(`/articles/${slug}`)
          .set('Authorization', `Token ${otherToken}`)
          .send({ article: { title: 'hacked' } })
          .expect(403)
          .expect((res) => {
            const body = res.body as ErrorsResponseBody;
            expect(body.errors.article).toContain(
              'you are not the author of this article',
            );
          });
      });

      it('updates the title and regenerates the slug', async () => {
        const res = await request(app.getHttpServer())
          .put(`/articles/${slug}`)
          .set('Authorization', `Token ${authorToken}`)
          .send({ article: { title: 'Updated Fixture Title' } })
          .expect(200);
        const body = res.body as ArticleResponseBody;
        expect(body.article.title).toBe('Updated Fixture Title');
        expect(body.article.slug).toMatch(/^updated-fixture-title-/);
        expect(body.article.slug).not.toBe(slug);
        slug = body.article.slug;
      });
    });

    describe('POST /articles/:slug/favorite and DELETE .../favorite', () => {
      it('returns 401 without a token', () => {
        return request(app.getHttpServer())
          .post(`/articles/${slug}/favorite`)
          .expect(401);
      });

      it('favorites the article and is idempotent, then unfavorites', async () => {
        await request(app.getHttpServer())
          .post(`/articles/${slug}/favorite`)
          .set('Authorization', `Token ${otherToken}`)
          .expect(201)
          .expect((res) => {
            const body = res.body as ArticleResponseBody;
            expect(body.article.favorited).toBe(true);
            expect(body.article.favoritesCount).toBe(1);
          });

        await request(app.getHttpServer())
          .post(`/articles/${slug}/favorite`)
          .set('Authorization', `Token ${otherToken}`)
          .expect(201)
          .expect((res) => {
            const body = res.body as ArticleResponseBody;
            expect(body.article.favoritesCount).toBe(1);
          });

        await request(app.getHttpServer())
          .delete(`/articles/${slug}/favorite`)
          .set('Authorization', `Token ${otherToken}`)
          .expect(200)
          .expect((res) => {
            const body = res.body as ArticleResponseBody;
            expect(body.article.favorited).toBe(false);
            expect(body.article.favoritesCount).toBe(0);
          });
      });
    });

    describe('GET /articles/feed', () => {
      it('returns 401 without a token', () => {
        return request(app.getHttpServer()).get('/articles/feed').expect(401);
      });

      it('excludes articles from unfollowed authors', () => {
        return request(app.getHttpServer())
          .get('/articles/feed')
          .set('Authorization', `Token ${otherToken}`)
          .expect(200)
          .expect((res) => {
            const body = res.body as ArticlesResponseBody;
            expect(body.articles.some((a) => a.slug === slug)).toBe(false);
          });
      });

      it('includes articles from followed authors', async () => {
        await request(app.getHttpServer())
          .post(`/profiles/${authorUsername}/follow`)
          .set('Authorization', `Token ${otherToken}`)
          .expect(201);

        await request(app.getHttpServer())
          .get('/articles/feed')
          .set('Authorization', `Token ${otherToken}`)
          .expect(200)
          .expect((res) => {
            const body = res.body as ArticlesResponseBody;
            expect(body.articles.some((a) => a.slug === slug)).toBe(true);
          });

        await request(app.getHttpServer())
          .delete(`/profiles/${authorUsername}/follow`)
          .set('Authorization', `Token ${otherToken}`);
      });
    });

    describe('DELETE /articles/:slug', () => {
      it('returns 401 without a token', () => {
        return request(app.getHttpServer())
          .delete(`/articles/${slug}`)
          .expect(401);
      });

      it("returns 403 when the caller is not the article's author", () => {
        return request(app.getHttpServer())
          .delete(`/articles/${slug}`)
          .set('Authorization', `Token ${otherToken}`)
          .expect(403);
      });

      it('deletes the article, which then 404s', async () => {
        await request(app.getHttpServer())
          .delete(`/articles/${slug}`)
          .set('Authorization', `Token ${authorToken}`)
          .expect(204);

        await request(app.getHttpServer()).get(`/articles/${slug}`).expect(404);

        const row = await articlesRepository.findOne({ where: { slug } });
        expect(row).toBeNull();
      });
    });
  });
});
