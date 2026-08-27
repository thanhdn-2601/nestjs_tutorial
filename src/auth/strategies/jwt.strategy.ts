import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { RedisService } from '../../redis/redis.service';
import { User } from '../../users/user.entity';
import { UsersService } from '../../users/users.service';
import { extractJwtFromAuthHeader } from '../jwt.constants';
import { JwtPayload } from '../jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly usersService: UsersService,
    private readonly redisService: RedisService,
  ) {
    super({
      jwtFromRequest: extractJwtFromAuthHeader,
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<User> {
    const isBlacklisted = await this.redisService.isTokenBlacklisted(
      payload.jti,
    );
    if (isBlacklisted) {
      throw new UnauthorizedException();
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException();
    }
    return user;
  }
}
