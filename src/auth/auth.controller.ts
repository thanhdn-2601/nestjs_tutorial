import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { User } from '../users/user.entity';
import { AuthService } from './auth.service';
import type { UserResponse } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
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
