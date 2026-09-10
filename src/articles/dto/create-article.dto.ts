import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDefined,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';
import { TrimString, TrimStringArray } from '../../common/trim.transform';

export class CreateArticleFieldsDto {
  @ApiProperty({ example: 'Cách học lập trình hiệu quả cho người mới bắt đầu' })
  @TrimString()
  @IsNotEmpty({ message: i18nValidationMessage('validation.is_not_empty') })
  @IsString({ message: i18nValidationMessage('validation.is_string') })
  title: string;

  @ApiProperty({
    example: 'Kinh nghiệm học lập trình dành cho developer mới vào nghề',
  })
  @TrimString()
  @IsNotEmpty({ message: i18nValidationMessage('validation.is_not_empty') })
  @IsString({ message: i18nValidationMessage('validation.is_string') })
  description: string;

  @ApiProperty({
    example:
      'Để học lập trình hiệu quả, bạn nên bắt đầu với một ngôn ngữ như JavaScript hoặc Python, sau đó thực hành qua các dự án thực tế...',
  })
  @TrimString()
  @IsNotEmpty({ message: i18nValidationMessage('validation.is_not_empty') })
  @IsString({ message: i18nValidationMessage('validation.is_string') })
  body: string;

  @ApiPropertyOptional({
    example: ['javascript', 'typescript'],
    type: [String],
  })
  @TrimStringArray()
  @IsOptional()
  @IsArray({ message: i18nValidationMessage('validation.is_array') })
  @IsString({
    each: true,
    message: i18nValidationMessage('validation.is_string'),
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
