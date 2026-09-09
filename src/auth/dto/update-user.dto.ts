import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDefined,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from '../password.constants';

export class UpdateUserFieldsDto {
  @ApiPropertyOptional({ example: 'thanh' })
  @IsOptional()
  @IsString({ message: i18nValidationMessage('validation.is_string') })
  @IsNotEmpty({ message: i18nValidationMessage('validation.is_not_empty') })
  username?: string;

  @ApiPropertyOptional({ example: 'ngocthanh@gmail.com' })
  @IsOptional()
  @IsEmail({}, { message: i18nValidationMessage('validation.is_email') })
  email?: string;

  @ApiPropertyOptional({
    minLength: PASSWORD_MIN_LENGTH,
    maxLength: PASSWORD_MAX_LENGTH,
  })
  @IsOptional()
  @IsString({ message: i18nValidationMessage('validation.is_string') })
  @MinLength(PASSWORD_MIN_LENGTH, {
    message: i18nValidationMessage('validation.min_length'),
  })
  @MaxLength(PASSWORD_MAX_LENGTH, {
    message: i18nValidationMessage('validation.max_length'),
  })
  password?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString({ message: i18nValidationMessage('validation.is_string') })
  bio?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString({ message: i18nValidationMessage('validation.is_string') })
  image?: string;
}

export class UpdateUserDto {
  @ApiProperty({ type: UpdateUserFieldsDto })
  @IsDefined({ message: i18nValidationMessage('validation.is_defined') })
  @ValidateNested()
  @Type(() => UpdateUserFieldsDto)
  user: UpdateUserFieldsDto;
}
