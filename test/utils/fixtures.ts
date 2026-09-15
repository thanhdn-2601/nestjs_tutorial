import { faker } from '@faker-js/faker';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { Article } from '../../src/articles/article.entity';
import { generateArticleSlug } from '../../src/articles/slug.util';
import { Comment } from '../../src/comments/comment.entity';
import { User } from '../../src/users/user.entity';

export async function seedUser(
  usersRepository: Repository<User>,
  overrides: Partial<Pick<User, 'username' | 'email' | 'bio' | 'image'>> = {},
): Promise<User> {
  const username =
    overrides.username ??
    `${faker.internet
      .userName()
      .toLowerCase()
      .replace(/[^a-z0-9_.-]/g, '')}_${randomUUID().slice(0, 8)}`;
  const user = usersRepository.create({
    username,
    email: overrides.email ?? `${username}@example.com`,
    password: 'seeded-password-hash',
    bio: overrides.bio ?? '',
    image: overrides.image ?? null,
  });
  return usersRepository.save(user);
}

/** Signs a valid access token for a seeded user without going through /users/login. */
export function signAccessToken(jwtService: JwtService, user: User): string {
  return jwtService.sign({
    sub: user.id,
    email: user.email,
    jti: randomUUID(),
  });
}

export async function seedArticle(
  articlesRepository: Repository<Article>,
  author: User,
  overrides: Partial<Pick<Article, 'title' | 'description' | 'body'>> = {},
): Promise<Article> {
  const title = overrides.title ?? faker.lorem.sentence();
  const article = articlesRepository.create({
    slug: generateArticleSlug(title),
    title,
    description: overrides.description ?? faker.lorem.sentence(),
    body: overrides.body ?? faker.lorem.paragraphs(2),
    authorId: author.id,
  });
  return articlesRepository.save(article);
}

export async function seedComment(
  commentsRepository: Repository<Comment>,
  article: Article,
  author: User,
  overrides: Partial<Pick<Comment, 'body'>> = {},
): Promise<Comment> {
  const comment = commentsRepository.create({
    body: overrides.body ?? faker.lorem.sentence(),
    articleId: article.id,
    authorId: author.id,
  });
  return commentsRepository.save(comment);
}
