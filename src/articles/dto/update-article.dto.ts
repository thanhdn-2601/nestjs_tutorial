import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDefined,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';
import { TrimString } from '../../common/trim.transform';
import {
  ARTICLE_BODY_MAX_LENGTH,
  ARTICLE_DESCRIPTION_MAX_LENGTH,
  ARTICLE_TITLE_MAX_LENGTH,
} from '../article.constants';

export class UpdateArticleFieldsDto {
  @ApiPropertyOptional({
    example: 'Cách học lập trình hiệu quả cho người mới bắt đầu',
    maxLength: ARTICLE_TITLE_MAX_LENGTH,
  })
  @TrimString()
  @IsOptional()
  @IsString({ message: i18nValidationMessage('validation.is_string') })
  @IsNotEmpty({ message: i18nValidationMessage('validation.is_not_empty') })
  @MaxLength(ARTICLE_TITLE_MAX_LENGTH, {
    message: i18nValidationMessage('validation.max_length'),
  })
  title?: string;

  @ApiPropertyOptional({
    example: 'Kinh nghiệm học lập trình dành cho developer mới vào nghề',
    maxLength: ARTICLE_DESCRIPTION_MAX_LENGTH,
  })
  @TrimString()
  @IsOptional()
  @IsString({ message: i18nValidationMessage('validation.is_string') })
  @IsNotEmpty({ message: i18nValidationMessage('validation.is_not_empty') })
  @MaxLength(ARTICLE_DESCRIPTION_MAX_LENGTH, {
    message: i18nValidationMessage('validation.max_length'),
  })
  description?: string;

  @ApiPropertyOptional({
    example:
      'Để học lập trình hiệu quả, bạn nên bắt đầu với một ngôn ngữ như JavaScript hoặc Python, sau đó thực hành qua các dự án thực tế...',
    maxLength: ARTICLE_BODY_MAX_LENGTH,
  })
  @TrimString()
  @IsOptional()
  @IsString({ message: i18nValidationMessage('validation.is_string') })
  @IsNotEmpty({ message: i18nValidationMessage('validation.is_not_empty') })
  @MaxLength(ARTICLE_BODY_MAX_LENGTH, {
    message: i18nValidationMessage('validation.max_length'),
  })
  body?: string;
}

export class UpdateArticleDto {
  @ApiProperty({ type: UpdateArticleFieldsDto })
  @IsDefined({ message: i18nValidationMessage('validation.is_defined') })
  @ValidateNested()
  @Type(() => UpdateArticleFieldsDto)
  article: UpdateArticleFieldsDto;
}
