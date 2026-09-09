import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { AVATAR_UPLOADS_DIR } from '../common/public-dir.constants';
import {
  ALLOWED_AVATAR_MIME_TYPES,
  MAX_AVATAR_SIZE_BYTES,
} from './avatar-upload.constants';

mkdirSync(AVATAR_UPLOADS_DIR, { recursive: true });

export const avatarUploadOptions = {
  storage: diskStorage({
    destination: (_req, _file, callback) => {
      callback(null, AVATAR_UPLOADS_DIR);
    },
    filename: (_req, file, callback) => {
      callback(null, `${randomUUID()}${extname(file.originalname)}`);
    },
  }),
  limits: { fileSize: MAX_AVATAR_SIZE_BYTES },
  fileFilter: (
    _req: Express.Request,
    file: Express.Multer.File,
    callback: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    if (!ALLOWED_AVATAR_MIME_TYPES.includes(file.mimetype)) {
      callback(new BadRequestException('Unsupported image type'), false);
      return;
    }
    callback(null, true);
  },
};
