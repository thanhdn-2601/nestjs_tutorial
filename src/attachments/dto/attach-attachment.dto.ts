import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsPositive,
  IsString,
} from 'class-validator';
import { AttachableType } from '../attachment.entity';

export class AttachAttachmentDto {
  @IsEnum(AttachableType)
  attachableType: AttachableType;

  @IsInt()
  @IsPositive()
  attachableId: number;

  @IsNotEmpty()
  @IsString()
  url: string;

  @IsNotEmpty()
  @IsString()
  fileName: string;

  @IsNotEmpty()
  @IsString()
  fileType: string;

  @IsInt()
  @IsPositive()
  fileSize: number;
}
