import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';
import {
  DEFAULT_ARTICLES_LIMIT,
  DEFAULT_ARTICLES_OFFSET,
  MAX_ARTICLES_LIMIT,
} from '../article.constants';

export class PaginationQueryDto {
  @ApiPropertyOptional({ example: DEFAULT_ARTICLES_LIMIT })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: i18nValidationMessage('validation.is_int') })
  @Min(1, { message: i18nValidationMessage('validation.min') })
  @Max(MAX_ARTICLES_LIMIT, { message: i18nValidationMessage('validation.max') })
  limit: number = DEFAULT_ARTICLES_LIMIT;

  @ApiPropertyOptional({ example: DEFAULT_ARTICLES_OFFSET })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: i18nValidationMessage('validation.is_int') })
  @Min(0, { message: i18nValidationMessage('validation.min') })
  offset: number = DEFAULT_ARTICLES_OFFSET;
}
