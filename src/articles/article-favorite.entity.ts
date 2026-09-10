import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

@Entity('article_favorites')
@Unique(['userId', 'articleId'])
export class ArticleFavorite {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @Column()
  articleId: number;

  @CreateDateColumn()
  createdAt: Date;
}
