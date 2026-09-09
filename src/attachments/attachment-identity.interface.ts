import { Attachment } from './attachment.entity';

export type AttachmentIdentity = Pick<Attachment, 'id' | 'url'>;
