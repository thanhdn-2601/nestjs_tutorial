import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity('article_tags')
@Unique(['articleId', 'name'])
export class ArticleTag {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  articleId: number;

  @Column()
  name: string;
}
