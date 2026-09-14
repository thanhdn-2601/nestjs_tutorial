import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { I18nService } from 'nestjs-i18n';
import { Repository } from 'typeorm';
import { ArticlesService } from '../articles/articles.service';
import { ProfilesService } from '../profiles/profiles.service';
import { User } from '../users/user.entity';
import {
  CommentDto,
  CommentResponse,
  CommentsResponse,
} from './comment-response.interface';
import { Comment } from './comment.entity';
import { CreateCommentFieldsDto } from './dto/create-comment.dto';

const NUMERIC_ID_PATTERN = /^\d+$/;

@Injectable()
export class CommentsService {
  constructor(
    private readonly articlesService: ArticlesService,
    private readonly profilesService: ProfilesService,
    private readonly i18n: I18nService,
    @InjectRepository(Comment)
    private readonly commentsRepository: Repository<Comment>,
  ) {}

  async create(
    currentUser: User,
    slug: string,
    dto: CreateCommentFieldsDto,
  ): Promise<CommentResponse> {
    const article = await this.articlesService.findBySlugOrFail(slug);
    const comment = await this.commentsRepository.save(
      this.commentsRepository.create({
        body: dto.body,
        articleId: article.id,
        authorId: currentUser.id,
      }),
    );

    return {
      comment: this.toCommentDto(comment, {
        author: currentUser,
        following: false,
      }),
    };
  }

  async findAllForArticle(
    slug: string,
    currentUserId?: number,
  ): Promise<CommentsResponse> {
    const article = await this.articlesService.findBySlugOrFail(slug);
    const comments = await this.commentsRepository.find({
      where: { articleId: article.id },
      order: { createdAt: 'DESC' },
      select: {
        id: true,
        body: true,
        authorId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!comments.length) return { comments: [] };

    const authorIds = [...new Set(comments.map((comment) => comment.authorId))];
    const authorsWithFollowing =
      await this.profilesService.getUsersWithFollowing(
        authorIds,
        currentUserId,
      );

    return {
      comments: comments.map((comment) => {
        const authorEntry = authorsWithFollowing.get(comment.authorId);
        if (!authorEntry) {
          throw new NotFoundException({
            errors: { id: [this.i18n.t('comments.comment_not_found')] },
          });
        }
        return this.toCommentDto(comment, {
          author: authorEntry.user,
          following: authorEntry.following,
        });
      }),
    };
  }

  async remove(currentUser: User, slug: string, id: string): Promise<void> {
    const article = await this.articlesService.findBySlugOrFail(slug);
    const comment = NUMERIC_ID_PATTERN.test(id)
      ? await this.commentsRepository.findOne({
          where: { id: Number(id), articleId: article.id },
          select: { id: true, authorId: true },
        })
      : null;
    if (!comment) {
      throw new NotFoundException({
        errors: { id: [this.i18n.t('comments.comment_not_found')] },
      });
    }
    if (comment.authorId !== currentUser.id) {
      throw new ForbiddenException({
        errors: { comment: [this.i18n.t('comments.forbidden')] },
      });
    }

    await this.commentsRepository.delete(comment.id);
  }

  private toCommentDto(
    comment: Comment,
    extras: { author: User; following: boolean },
  ): CommentDto {
    return {
      id: comment.id,
      createdAt: comment.createdAt.toISOString(),
      updatedAt: comment.updatedAt.toISOString(),
      body: comment.body,
      author: {
        username: extras.author.username,
        bio: extras.author.bio,
        image: extras.author.image,
        following: extras.following,
      },
    };
  }
}
