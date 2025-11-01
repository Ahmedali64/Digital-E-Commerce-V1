import { CacheModuleOptions } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import * as redisStore from 'cache-manager-redis-store';

export const redisConfig = (
  configService: ConfigService,
): CacheModuleOptions => ({
  store: redisStore,
  host: configService.get<string>('REDIS_HOST', 'localhost'),
  port: configService.get<number>('REDIS_PORT', 6379),
  password: configService.get<string>('REDIS_PASSWORD'),
  ttl: configService.get<number>('REDIS_TTL', 3600), // 1 hour default
  max: 100, // Maximum number of items in cache
});
