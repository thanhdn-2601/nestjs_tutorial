import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';

const BLACKLIST_PREFIX = 'blacklist:';

@Injectable()
export class RedisService implements OnModuleDestroy {
  constructor(@Inject(REDIS_CLIENT) private readonly client: Redis) {}

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }

  async blacklistToken(
    jti: string | undefined,
    ttlSeconds: number,
  ): Promise<void> {
    if (!jti || ttlSeconds <= 0) return;
    await this.client.set(`${BLACKLIST_PREFIX}${jti}`, '1', 'EX', ttlSeconds);
  }

  async isTokenBlacklisted(jti: string | undefined): Promise<boolean> {
    if (!jti) return false;
    const value = await this.client.get(`${BLACKLIST_PREFIX}${jti}`);
    return value !== null;
  }
}
