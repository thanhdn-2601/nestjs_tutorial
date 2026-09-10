import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProfilesModule } from '../profiles/profiles.module';
import { ArticleFavorite } from './article-favorite.entity';
import { ArticleTag } from './article-tag.entity';
import { Article } from './article.entity';
import { ArticlesController } from './articles.controller';
import { ArticlesService } from './articles.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Article, ArticleTag, ArticleFavorite]),
    ProfilesModule,
  ],
  controllers: [ArticlesController],
  providers: [ArticlesService],
})
export class ArticlesModule {}
