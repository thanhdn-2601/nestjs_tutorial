import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDefined,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';
import { TrimString, TrimStringArray } from '../../common/trim.transform';
import {
  ARTICLE_BODY_MAX_LENGTH,
  ARTICLE_DESCRIPTION_MAX_LENGTH,
  ARTICLE_TAG_MAX_LENGTH,
  ARTICLE_TITLE_MAX_LENGTH,
  MAX_TAGS_PER_ARTICLE,
} from '../article.constants';

export class CreateArticleFieldsDto {
  @ApiProperty({
    example: 'Cách học lập trình hiệu quả cho người mới bắt đầu',
    maxLength: ARTICLE_TITLE_MAX_LENGTH,
  })
  @TrimString()
  @IsNotEmpty({ message: i18nValidationMessage('validation.is_not_empty') })
  @IsString({ message: i18nValidationMessage('validation.is_string') })
  @MaxLength(ARTICLE_TITLE_MAX_LENGTH, {
    message: i18nValidationMessage('validation.max_length'),
  })
  title: string;

  @ApiProperty({
    example: 'Kinh nghiệm học lập trình dành cho developer mới vào nghề',
    maxLength: ARTICLE_DESCRIPTION_MAX_LENGTH,
  })
  @TrimString()
  @IsNotEmpty({ message: i18nValidationMessage('validation.is_not_empty') })
  @IsString({ message: i18nValidationMessage('validation.is_string') })
  @MaxLength(ARTICLE_DESCRIPTION_MAX_LENGTH, {
    message: i18nValidationMessage('validation.max_length'),
  })
  description: string;

  @ApiProperty({
    example:
      'Để học lập trình hiệu quả, bạn nên bắt đầu với một ngôn ngữ như JavaScript hoặc Python, sau đó thực hành qua các dự án thực tế...',
    maxLength: ARTICLE_BODY_MAX_LENGTH,
  })
  @TrimString()
  @IsNotEmpty({ message: i18nValidationMessage('validation.is_not_empty') })
  @IsString({ message: i18nValidationMessage('validation.is_string') })
  @MaxLength(ARTICLE_BODY_MAX_LENGTH, {
    message: i18nValidationMessage('validation.max_length'),
  })
  body: string;

  @ApiPropertyOptional({
    example: ['javascript', 'typescript'],
    type: [String],
    maxItems: MAX_TAGS_PER_ARTICLE,
  })
  @TrimStringArray()
  @IsOptional()
  @IsArray({ message: i18nValidationMessage('validation.is_array') })
  @ArrayMaxSize(MAX_TAGS_PER_ARTICLE, {
    message: i18nValidationMessage('validation.array_max_size'),
  })
  @IsString({
    each: true,
    message: i18nValidationMessage('validation.is_string'),
  })
  @MaxLength(ARTICLE_TAG_MAX_LENGTH, {
    each: true,
    message: i18nValidationMessage('validation.max_length'),
  })
  tagList?: string[];
}

export class CreateArticleDto {
  @ApiProperty({ type: CreateArticleFieldsDto })
  @IsDefined({ message: i18nValidationMessage('validation.is_defined') })
  @ValidateNested()
  @Type(() => CreateArticleFieldsDto)
  article: CreateArticleFieldsDto;
}
