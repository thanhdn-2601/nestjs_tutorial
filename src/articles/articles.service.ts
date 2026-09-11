import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { I18nService } from 'nestjs-i18n';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { isUniqueViolation } from '../common/postgres-errors';
import { ProfilesService } from '../profiles/profiles.service';
import { User } from '../users/user.entity';
import {
  ArticleDto,
  ArticleResponse,
  ArticlesResponse,
} from './article-response.interface';
import { ArticleFavorite } from './article-favorite.entity';
import { ArticleTag } from './article-tag.entity';
import { Article } from './article.entity';
import { MAX_SLUG_ATTEMPTS } from './article.constants';
import { CreateArticleFieldsDto } from './dto/create-article.dto';
import { ListArticlesQueryDto } from './dto/list-articles-query.dto';
import { PaginationQueryDto } from './dto/pagination-query.dto';
import { UpdateArticleFieldsDto } from './dto/update-article.dto';
import { generateArticleSlug } from './slug.util';

@Injectable()
export class ArticlesService {
  constructor(
    private readonly profilesService: ProfilesService,
    private readonly i18n: I18nService,
    @InjectRepository(Article)
    private readonly articlesRepository: Repository<Article>,
    @InjectRepository(ArticleTag)
    private readonly articleTagsRepository: Repository<ArticleTag>,
    @InjectRepository(ArticleFavorite)
    private readonly articleFavoritesRepository: Repository<ArticleFavorite>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async create(
    author: User,
    dto: CreateArticleFieldsDto,
  ): Promise<ArticleResponse> {
    const tagList = [...new Set(dto.tagList ?? [])];

    const article = await this.withSlugRetry(dto.title, (slug) =>
      this.dataSource.transaction(async (manager) => {
        const created = await manager.save(
          manager.create(Article, {
            slug,
            title: dto.title,
            description: dto.description,
            body: dto.body,
            authorId: author.id,
          }),
        );
        if (tagList.length) {
          await manager.insert(
            ArticleTag,
            tagList.map((name) => ({ articleId: created.id, name })),
          );
        }
        return created;
      }),
    );

    return {
      article: this.toArticleDto(article, {
        tagList,
        favoritesCount: 0,
        favorited: false,
        author,
        following: false,
      }),
    };
  }

  async findAll(
    query: ListArticlesQueryDto,
    currentUserId?: number,
  ): Promise<ArticlesResponse> {
    const qb = this.articlesRepository.createQueryBuilder('article');

    if (query.tag) {
      qb.innerJoin(
        'article_tags',
        'tag',
        'tag."articleId" = article.id AND tag.name = :tag',
        { tag: query.tag },
      );
    }
    if (query.author) {
      qb.innerJoin(
        'users',
        'author_user',
        'author_user.id = article."authorId" AND author_user.username = :authorUsername',
        { authorUsername: query.author },
      );
    }
    if (query.favorited) {
      qb.innerJoin(
        'article_favorites',
        'favorite',
        'favorite."articleId" = article.id',
      ).innerJoin(
        'users',
        'favorited_by',
        'favorited_by.id = favorite."userId" AND favorited_by.username = :favoritedUsername',
        { favoritedUsername: query.favorited },
      );
    }

    return this.paginate(qb, query, currentUserId);
  }

  async findFeed(
    currentUserId: number,
    query: PaginationQueryDto,
  ): Promise<ArticlesResponse> {
    const qb = this.articlesRepository
      .createQueryBuilder('article')
      .innerJoin(
        'follows',
        'follow',
        'follow."followeeId" = article."authorId" AND follow."followerId" = :currentUserId',
        { currentUserId },
      );

    return this.paginate(qb, query, currentUserId);
  }

  async findOne(
    slug: string,
    currentUserId?: number,
  ): Promise<ArticleResponse> {
    const article = await this.findArticleOrFail(slug);
    return this.buildArticleResponse(article, currentUserId);
  }

  async update(
    currentUser: User,
    slug: string,
    dto: UpdateArticleFieldsDto,
  ): Promise<ArticleResponse> {
    const updated = await this.dataSource.transaction(async (manager) => {
      const article = await this.lockArticleOrFail(manager, slug);
      this.assertIsAuthor(currentUser, article);

      if (dto.description !== undefined) article.description = dto.description;
      if (dto.body !== undefined) article.body = dto.body;

      if (dto.title !== undefined) {
        return this.withSlugRetry(dto.title, (newSlug) => {
          article.title = dto.title as string;
          article.slug = newSlug;
          return manager.save(article);
        });
      }
      return manager.save(article);
    });

    return this.buildArticleResponse(updated, currentUser.id);
  }

  async remove(currentUser: User, slug: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const article = await this.lockArticleOrFail(manager, slug);
      this.assertIsAuthor(currentUser, article);
      await manager.delete(Article, article.id);
    });
  }

  async favorite(
    currentUserId: number,
    slug: string,
  ): Promise<ArticleResponse> {
    const article = await this.findArticleOrFail(slug);
    try {
      await this.articleFavoritesRepository.insert({
        userId: currentUserId,
        articleId: article.id,
      });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
    return this.buildArticleResponse(article, currentUserId);
  }

  async unfavorite(
    currentUserId: number,
    slug: string,
  ): Promise<ArticleResponse> {
    const article = await this.findArticleOrFail(slug);
    await this.articleFavoritesRepository.delete({
      userId: currentUserId,
      articleId: article.id,
    });
    return this.buildArticleResponse(article, currentUserId);
  }

  private async withSlugRetry<T>(
    title: string,
    save: (slug: string) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 1; ; attempt++) {
      try {
        return await save(generateArticleSlug(title));
      } catch (error) {
        if (attempt >= MAX_SLUG_ATTEMPTS || !isUniqueViolation(error)) {
          throw error;
        }
      }
    }
  }

  private async paginate(
    qb: ReturnType<Repository<Article>['createQueryBuilder']>,
    query: PaginationQueryDto,
    currentUserId?: number,
  ): Promise<ArticlesResponse> {
    const [articlesCount, articles] = await Promise.all([
      qb.clone().getCount(),
      qb
        .clone()
        .orderBy('article.createdAt', 'DESC')
        .limit(query.limit)
        .offset(query.offset)
        .getMany(),
    ]);

    return {
      articles: await this.buildArticleDtos(articles, currentUserId),
      articlesCount,
    };
  }

  private async findArticleOrFail(slug: string): Promise<Article> {
    const article = await this.articlesRepository.findOne({
      where: { slug },
    });
    if (!article) {
      throw new NotFoundException({
        errors: { slug: [this.i18n.t('articles.article_not_found')] },
      });
    }
    return article;
  }

  private async lockArticleOrFail(
    manager: EntityManager,
    slug: string,
  ): Promise<Article> {
    const article = await manager.findOne(Article, {
      where: { slug },
      lock: { mode: 'pessimistic_write' },
    });
    if (!article) {
      throw new NotFoundException({
        errors: { slug: [this.i18n.t('articles.article_not_found')] },
      });
    }
    return article;
  }

  private assertIsAuthor(currentUser: User, article: Article): void {
    if (article.authorId !== currentUser.id) {
      throw new ForbiddenException({
        errors: { article: [this.i18n.t('articles.forbidden')] },
      });
    }
  }

  private async buildArticleResponse(
    article: Article,
    currentUserId?: number,
  ): Promise<ArticleResponse> {
    const [tags, favoriteStats, authorsWithFollowing] = await Promise.all([
      this.articleTagsRepository.find({
        where: { articleId: article.id },
        select: { name: true },
      }),
      this.getFavoriteStats([article.id], currentUserId),
      this.profilesService.getUsersWithFollowing(
        [article.authorId],
        currentUserId,
      ),
    ]);

    const authorEntry = authorsWithFollowing.get(article.authorId);
    if (!authorEntry) {
      throw new NotFoundException({
        errors: { slug: [this.i18n.t('articles.article_not_found')] },
      });
    }
    const stats = favoriteStats.get(article.id);

    return {
      article: this.toArticleDto(article, {
        tagList: tags.map((tag) => tag.name),
        favoritesCount: stats?.count ?? 0,
        favorited: stats?.favorited ?? false,
        author: authorEntry.user,
        following: authorEntry.following,
      }),
    };
  }

  private async buildArticleDtos(
    articles: Article[],
    currentUserId?: number,
  ): Promise<ArticleDto[]> {
    if (!articles.length) return [];

    const articleIds = articles.map((article) => article.id);
    const authorIds = [...new Set(articles.map((article) => article.authorId))];

    const [tags, favoriteStats, authorsWithFollowing] = await Promise.all([
      this.articleTagsRepository.find({
        where: { articleId: In(articleIds) },
        select: { articleId: true, name: true },
      }),
      this.getFavoriteStats(articleIds, currentUserId),
      this.profilesService.getUsersWithFollowing(authorIds, currentUserId),
    ]);

    const tagsByArticle = this.groupBy(tags, (tag) => tag.articleId);

    return articles.map((article) => {
      const authorEntry = authorsWithFollowing.get(article.authorId);
      if (!authorEntry) {
        throw new NotFoundException({
          errors: { slug: [this.i18n.t('articles.article_not_found')] },
        });
      }
      const stats = favoriteStats.get(article.id);
      return this.toArticleDto(article, {
        tagList: (tagsByArticle.get(article.id) ?? []).map((tag) => tag.name),
        favoritesCount: stats?.count ?? 0,
        favorited: stats?.favorited ?? false,
        author: authorEntry.user,
        following: authorEntry.following,
      });
    });
  }

  private async getFavoriteStats(
    articleIds: number[],
    currentUserId?: number,
  ): Promise<Map<number, { count: number; favorited: boolean }>> {
    if (!articleIds.length) return new Map();

    const rows = await this.articleFavoritesRepository
      .createQueryBuilder('favorite')
      .select('favorite."articleId"', 'articleId')
      .addSelect('COUNT(*)', 'count')
      .addSelect(
        currentUserId !== undefined
          ? 'COUNT(*) FILTER (WHERE favorite."userId" = :currentUserId)'
          : '0',
        'myCount',
      )
      .where('favorite."articleId" IN (:...articleIds)', {
        articleIds,
        ...(currentUserId !== undefined ? { currentUserId } : {}),
      })
      .groupBy('favorite."articleId"')
      .getRawMany<{ articleId: string; count: string; myCount: string }>();

    return new Map(
      rows.map((row) => [
        Number(row.articleId),
        { count: Number(row.count), favorited: Number(row.myCount) > 0 },
      ]),
    );
  }

  private toArticleDto(
    article: Article,
    extras: {
      tagList: string[];
      favoritesCount: number;
      favorited: boolean;
      author: User;
      following: boolean;
    },
  ): ArticleDto {
    return {
      slug: article.slug,
      title: article.title,
      description: article.description,
      body: article.body,
      tagList: [...extras.tagList].sort(),
      createdAt: article.createdAt.toISOString(),
      updatedAt: article.updatedAt.toISOString(),
      favorited: extras.favorited,
      favoritesCount: extras.favoritesCount,
      author: {
        username: extras.author.username,
        bio: extras.author.bio,
        image: extras.author.image,
        following: extras.following,
      },
    };
  }

  private groupBy<T, K>(items: T[], keyFn: (item: T) => K): Map<K, T[]> {
    const map = new Map<K, T[]>();
    for (const item of items) {
      const key = keyFn(item);
      const group = map.get(key);
      if (group) {
        group.push(item);
      } else {
        map.set(key, [item]);
      }
    }
    return map;
  }
}
