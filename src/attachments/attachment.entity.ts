import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';

export enum AttachableType {
  USER = 'user',
}

@Entity('attachments')
@Index(['attachableType', 'attachableId'])
export class Attachment {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: AttachableType })
  attachableType: AttachableType;

  @Column()
  attachableId: number;

  @Column()
  url: string;

  @Column()
  fileName: string;

  @Column()
  fileType: string;

  @Column()
  fileSize: number;

  @CreateDateColumn()
  createdAt: Date;
}
