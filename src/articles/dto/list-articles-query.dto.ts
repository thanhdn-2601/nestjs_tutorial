import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';
import { PaginationQueryDto } from './pagination-query.dto';

export class ListArticlesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: 'javascript' })
  @IsOptional()
  @IsString({ message: i18nValidationMessage('validation.is_string') })
  tag?: string;

  @ApiPropertyOptional({ example: 'thanhdev' })
  @IsOptional()
  @IsString({ message: i18nValidationMessage('validation.is_string') })
  author?: string;

  @ApiPropertyOptional({ example: 'thanhdev' })
  @IsOptional()
  @IsString({ message: i18nValidationMessage('validation.is_string') })
  favorited?: string;
}
