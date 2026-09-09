import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { randomUUID } from 'crypto';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { EntityManager, Repository } from 'typeorm';
import { PUBLIC_DIR } from '../common/public-dir.constants';
import { AttachmentIdentity } from './attachment-identity.interface';
import { AttachableType, Attachment } from './attachment.entity';
import { AttachAttachmentDto } from './dto/attach-attachment.dto';

@Injectable()
export class AttachmentsService {
  constructor(
    @InjectRepository(Attachment)
    private readonly attachmentsRepository: Repository<Attachment>,
  ) {}

  async attach(
    data: AttachAttachmentDto,
    manager: EntityManager = this.attachmentsRepository.manager,
  ): Promise<Attachment> {
    const dto = plainToInstance(AttachAttachmentDto, data);
    const errors = await validate(dto);
    if (errors.length) {
      throw new UnprocessableEntityException(errors);
    }

    const repository = manager.getRepository(Attachment);
    return repository.save(repository.create({ id: randomUUID(), ...dto }));
  }

  findAllFor(
    attachableType: AttachableType,
    attachableId: number,
    manager: EntityManager = this.attachmentsRepository.manager,
  ): Promise<AttachmentIdentity[]> {
    return manager.getRepository(Attachment).find({
      where: { attachableType, attachableId },
      select: { id: true, url: true },
    });
  }

  async removeMany(
    attachments: AttachmentIdentity[],
    manager: EntityManager = this.attachmentsRepository.manager,
  ): Promise<void> {
    if (!attachments.length) return;
    await manager
      .getRepository(Attachment)
      .delete(attachments.map((attachment) => attachment.id));
  }

  deleteFile(url: string): Promise<void> {
    return unlink(join(PUBLIC_DIR, url));
  }
}
