import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDefined,
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';

export class RegisterUserDto {
  @ApiProperty({ example: 'Thanh' })
  @IsNotEmpty({ message: i18nValidationMessage('validation.is_not_empty') })
  @IsString({ message: i18nValidationMessage('validation.is_string') })
  username: string;

  @ApiProperty({ example: 'ngocthanh@gmail.com' })
  @IsNotEmpty({ message: i18nValidationMessage('validation.is_not_empty') })
  @IsEmail({}, { message: i18nValidationMessage('validation.is_email') })
  email: string;

  @ApiProperty({ example: 'Aa@123456', minLength: 8, maxLength: 72 })
  @IsNotEmpty({ message: i18nValidationMessage('validation.is_not_empty') })
  @IsString({ message: i18nValidationMessage('validation.is_string') })
  @MinLength(8, { message: i18nValidationMessage('validation.min_length') })
  @MaxLength(72, { message: i18nValidationMessage('validation.max_length') })
  password: string;
}

export class RegisterDto {
  @ApiProperty({ type: RegisterUserDto })
  @IsDefined({ message: i18nValidationMessage('validation.is_defined') })
  @ValidateNested()
  @Type(() => RegisterUserDto)
  user: RegisterUserDto;
}
