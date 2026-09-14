import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDefined,
  IsNotEmpty,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';
import { TrimString } from '../../common/trim.transform';
import { COMMENT_BODY_MAX_LENGTH } from '../comment.constants';

export class CreateCommentFieldsDto {
  @ApiProperty({
    example: 'Bài viết rất hữu ích, cảm ơn bạn đã chia sẻ!',
    maxLength: COMMENT_BODY_MAX_LENGTH,
  })
  @TrimString()
  @IsNotEmpty({ message: i18nValidationMessage('validation.is_not_empty') })
  @IsString({ message: i18nValidationMessage('validation.is_string') })
  @MaxLength(COMMENT_BODY_MAX_LENGTH, {
    message: i18nValidationMessage('validation.max_length'),
  })
  body: string;
}

export class CreateCommentDto {
  @ApiProperty({ type: CreateCommentFieldsDto })
  @IsDefined({ message: i18nValidationMessage('validation.is_defined') })
  @ValidateNested()
  @Type(() => CreateCommentFieldsDto)
  comment: CreateCommentFieldsDto;
}
