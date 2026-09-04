import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

@Entity('follows')
@Unique(['followerId', 'followeeId'])
export class Follow {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  followerId: number;

  @Column()
  followeeId: number;

  @CreateDateColumn()
  createdAt: Date;
}
