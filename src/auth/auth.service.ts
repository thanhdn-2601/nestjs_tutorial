import {
  Injectable,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectDataSource } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { I18nService } from 'nestjs-i18n';
import { DataSource } from 'typeorm';
import { AttachableType } from '../attachments/attachment.entity';
import { AttachmentsService } from '../attachments/attachments.service';
import { isUniqueViolation } from '../common/postgres-errors';
import { RedisService } from '../redis/redis.service';
import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { PASSWORD_SALT_ROUNDS } from './password.constants';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UpdateUserFieldsDto } from './dto/update-user.dto';
import { JwtPayload } from './jwt-payload.interface';

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
    private readonly attachmentsService: AttachmentsService,
    @InjectDataSource() private readonly dataSource: DataSource,
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

  async updateAvatar(
    user: User,
    file: Express.Multer.File,
  ): Promise<UserResponse> {
    const { updated, stale } = await this.dataSource.transaction(
      async (manager) => {
        const lockedUser = await manager.findOneOrFail(User, {
          where: { id: user.id },
          lock: { mode: 'pessimistic_write' },
        });

        const attachment = await this.attachmentsService.attach(
          {
            attachableType: AttachableType.USER,
            attachableId: lockedUser.id,
            url: `/uploads/avatars/${file.filename}`,
            fileName: file.originalname,
            fileType: file.mimetype,
            fileSize: file.size,
          },
          manager,
        );

        const stale = (
          await this.attachmentsService.findAllFor(
            AttachableType.USER,
            lockedUser.id,
            manager,
          )
        ).filter((existing) => existing.id !== attachment.id);

        lockedUser.image = attachment.url;
        const updated = await manager.save(lockedUser);
        await this.attachmentsService.removeMany(stale, manager);

        return { updated, stale };
      },
    );

    await Promise.all(
      stale.map((attachment) =>
        this.attachmentsService
          .deleteFile(attachment.url)
          .catch(() => undefined),
      ),
    );

    return this.buildUserResponse(updated);
  }

  async updateUser(
    user: User,
    dto: UpdateUserFieldsDto,
  ): Promise<UserResponse> {
    const emailChanged = !!dto.email && dto.email.toLowerCase() !== user.email;
    const usernameChanged = !!dto.username && dto.username !== user.username;

    const [existingByEmail, existingByUsername] = await Promise.all([
      emailChanged ? this.usersService.findByEmail(dto.email as string) : null,
      usernameChanged
        ? this.usersService.findByUsername(dto.username as string)
        : null,
    ]);

    const errors: Record<string, string[]> = {};
    if (existingByEmail) errors.email = [this.i18n.t('auth.email_taken')];
    if (existingByUsername)
      errors.username = [this.i18n.t('auth.username_taken')];
    if (Object.keys(errors).length) {
      throw new UnprocessableEntityException({ errors });
    }

    const hashedPassword = dto.password
      ? await bcrypt.hash(dto.password, PASSWORD_SALT_ROUNDS)
      : undefined;

    try {
      const updated = await this.dataSource.transaction(async (manager) => {
        const lockedUser = await manager.findOneOrFail(User, {
          where: { id: user.id },
          lock: { mode: 'pessimistic_write' },
        });

        if (dto.username !== undefined) lockedUser.username = dto.username;
        if (dto.email !== undefined) lockedUser.email = dto.email.toLowerCase();
        if (dto.bio !== undefined) lockedUser.bio = dto.bio;
        if (dto.image !== undefined) lockedUser.image = dto.image;
        if (hashedPassword !== undefined) lockedUser.password = hashedPassword;

        return manager.save(lockedUser);
      });
      return this.buildUserResponse(updated);
    } catch (error) {
      throw this.toUniqueViolationError(error) ?? error;
    }
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
    if (!isUniqueViolation(error)) return null;

    const detail = (error as { detail?: string }).detail ?? '';
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
