import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDefined,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';
import { TrimString } from '../../common/trim.transform';

export class UpdateArticleFieldsDto {
  @ApiPropertyOptional({
    example: 'Cách học lập trình hiệu quả cho người mới bắt đầu',
  })
  @TrimString()
  @IsOptional()
  @IsString({ message: i18nValidationMessage('validation.is_string') })
  @IsNotEmpty({ message: i18nValidationMessage('validation.is_not_empty') })
  title?: string;

  @ApiPropertyOptional({
    example: 'Kinh nghiệm học lập trình dành cho developer mới vào nghề',
  })
  @TrimString()
  @IsOptional()
  @IsString({ message: i18nValidationMessage('validation.is_string') })
  @IsNotEmpty({ message: i18nValidationMessage('validation.is_not_empty') })
  description?: string;

  @ApiPropertyOptional({
    example:
      'Để học lập trình hiệu quả, bạn nên bắt đầu với một ngôn ngữ như JavaScript hoặc Python, sau đó thực hành qua các dự án thực tế...',
  })
  @TrimString()
  @IsOptional()
  @IsString({ message: i18nValidationMessage('validation.is_string') })
  @IsNotEmpty({ message: i18nValidationMessage('validation.is_not_empty') })
  body?: string;
}

export class UpdateArticleDto {
  @ApiProperty({ type: UpdateArticleFieldsDto })
  @IsDefined({ message: i18nValidationMessage('validation.is_defined') })
  @ValidateNested()
  @Type(() => UpdateArticleFieldsDto)
  article: UpdateArticleFieldsDto;
}
