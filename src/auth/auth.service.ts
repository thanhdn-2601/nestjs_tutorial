import {
  Injectable,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { I18nService } from 'nestjs-i18n';
import { QueryFailedError } from 'typeorm';
import { RedisService } from '../redis/redis.service';
import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { PASSWORD_SALT_ROUNDS } from './password.constants';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from './jwt-payload.interface';

const POSTGRES_UNIQUE_VIOLATION = '23505';

export interface UserResponse {
  user: {
    email: string;
    token: string;
    username: string;
    bio: string;
    image: string | null;
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly i18n: I18nService,
    private readonly redisService: RedisService,
  ) {}

  async register({ user }: RegisterDto): Promise<UserResponse> {
    const [existingByEmail, existingByUsername] = await Promise.all([
      this.usersService.findByEmail(user.email),
      this.usersService.findByUsername(user.username),
    ]);

    const errors: Record<string, string[]> = {};
    if (existingByEmail) errors.email = [this.i18n.t('auth.email_taken')];
    if (existingByUsername)
      errors.username = [this.i18n.t('auth.username_taken')];
    if (Object.keys(errors).length) {
      throw new UnprocessableEntityException({ errors });
    }

    const hashedPassword = await bcrypt.hash(
      user.password,
      PASSWORD_SALT_ROUNDS,
    );
    try {
      const created = await this.usersService.create({
        username: user.username,
        email: user.email,
        password: hashedPassword,
      });
      return this.buildUserResponse(created);
    } catch (error) {
      throw this.toUniqueViolationError(error) ?? error;
    }
  }

  async login({ user }: LoginDto): Promise<UserResponse> {
    const existing = await this.usersService.findByEmail(user.email);
    if (!existing) {
      throw new UnauthorizedException({
        errors: { email: [this.i18n.t('auth.email_not_found')] },
      });
    }

    const passwordMatches = await bcrypt.compare(
      user.password,
      existing.password,
    );
    if (!passwordMatches) {
      throw new UnauthorizedException({
        errors: { password: [this.i18n.t('auth.invalid_password')] },
      });
    }

    return this.buildUserResponse(existing);
  }

  buildUserResponse(user: User): UserResponse {
    const token = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      jti: randomUUID(),
    });
    return {
      user: {
        email: user.email,
        token,
        username: user.username,
        bio: user.bio,
        image: user.image,
      },
    };
  }

  async logout(token: string): Promise<void> {
    const payload = this.jwtService.decode<JwtPayload>(token);
    if (!payload?.exp) return;

    const ttlSeconds = payload.exp - Math.floor(Date.now() / 1000);
    await this.redisService.blacklistToken(payload.jti, ttlSeconds);
  }

  private toUniqueViolationError(
    error: unknown,
  ): UnprocessableEntityException | null {
    const isUniqueViolation =
      error instanceof QueryFailedError &&
      (error as unknown as { code?: string }).code ===
        POSTGRES_UNIQUE_VIOLATION;
    if (!isUniqueViolation) return null;

    const detail = (error as unknown as { detail?: string }).detail ?? '';
    const field = detail.includes('(email)')
      ? 'email'
      : detail.includes('(username)')
        ? 'username'
        : null;
    if (!field) return null;

    const message =
      field === 'email'
        ? this.i18n.t('auth.email_taken')
        : this.i18n.t('auth.username_taken');
    return new UnprocessableEntityException({ errors: { [field]: [message] } });
  }
}
