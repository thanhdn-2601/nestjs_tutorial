import {
  Body,
  Controller,
  Get,
  HttpCode,
  ParseFilePipeBuilder,
  Post,
  Put,
  Req,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import type { User } from '../users/user.entity';
import { AuthService } from './auth.service';
import type { UserResponse } from './auth.service';
import { avatarUploadOptions } from './avatar-upload.options';
import { CurrentUser } from './decorators/current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { extractJwtFromAuthHeader } from './jwt.constants';

@ApiTags('auth')
@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({ summary: 'Register a new user' })
  @Post('users')
  register(@Body() dto: RegisterDto): Promise<UserResponse> {
    return this.authService.register(dto);
  }

  @ApiOperation({ summary: 'Log in with email and password' })
  @Post('users/login')
  login(@Body() dto: LoginDto): Promise<UserResponse> {
    return this.authService.login(dto);
  }

  @ApiOperation({ summary: 'Get the currently authenticated user' })
  @ApiSecurity('token')
  @Get('user')
  @UseGuards(JwtAuthGuard)
  getCurrentUser(@CurrentUser() user: User): UserResponse {
    return this.authService.buildUserResponse(user);
  }

  @ApiOperation({ summary: 'Update the current user' })
  @ApiSecurity('token')
  @Put('user')
  @UseGuards(JwtAuthGuard)
  updateUser(
    @CurrentUser() user: User,
    @Body() dto: UpdateUserDto,
  ): Promise<UserResponse> {
    return this.authService.updateUser(user, dto.user);
  }

  @ApiOperation({ summary: "Upload the current user's avatar" })
  @ApiSecurity('token')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { avatar: { type: 'string', format: 'binary' } },
    },
  })
  @Post('user/avatar')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('avatar', avatarUploadOptions))
  updateAvatar(
    @CurrentUser() user: User,
    @UploadedFile(new ParseFilePipeBuilder().build({ fileIsRequired: true }))
    file: Express.Multer.File,
  ): Promise<UserResponse> {
    return this.authService.updateAvatar(user, file);
  }

  @ApiOperation({ summary: 'Log out the current session' })
  @ApiSecurity('token')
  @Post('user/logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(204)
  logout(@Req() req: Request): Promise<void> {
    const token = extractJwtFromAuthHeader(req);
    if (!token) {
      throw new UnauthorizedException();
    }
    return this.authService.logout(token);
  }
}
