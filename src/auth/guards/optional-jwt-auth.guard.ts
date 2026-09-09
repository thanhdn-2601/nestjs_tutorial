import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { User } from '../../users/user.entity';
import { extractJwtFromAuthHeader } from '../jwt.constants';

/**
 * Authenticates the request when a token is present, but never rejects one with
 * no token at all. A token that IS present and invalid (expired, malformed,
 * blacklisted) still fails with 401 — only "no credentials supplied" is optional.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = User | undefined>(
    err: unknown,
    user: User | false,
    _info: unknown,
    context: ExecutionContext,
  ): TUser {
    const request = context.switchToHttp().getRequest<Request>();
    const hadToken = Boolean(extractJwtFromAuthHeader(request));

    if (!hadToken) {
      return undefined as TUser;
    }
    if (err || !user) {
      throw err instanceof Error ? err : new UnauthorizedException();
    }
    return user as TUser;
  }
}
