import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDefined,
  IsEmail,
  IsNotEmpty,
  IsString,
  ValidateNested,
} from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';

export class LoginUserDto {
  @ApiProperty({ example: 'ngocthanh@gmail.com' })
  @IsNotEmpty({ message: i18nValidationMessage('validation.is_not_empty') })
  @IsEmail({}, { message: i18nValidationMessage('validation.is_email') })
  email: string;

  @ApiProperty({ example: 'Aa@123456' })
  @IsNotEmpty({ message: i18nValidationMessage('validation.is_not_empty') })
  @IsString({ message: i18nValidationMessage('validation.is_string') })
  password: string;
}

export class LoginDto {
  @ApiProperty({ type: LoginUserDto })
  @IsDefined({ message: i18nValidationMessage('validation.is_defined') })
  @ValidateNested()
  @Type(() => LoginUserDto)
  user: LoginUserDto;
}
