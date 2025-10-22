import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip props that don't have decorators
      forbidNonWhitelisted: true, // Throw error if extra props sent
      transform: true, // Auto-transform payloads from object to DTO instances
    }),
  );

  app.enableShutdownHooks();

  const configService = app.get(ConfigService);
  const PORT = configService.get<number>('PORT', 3000);
  const ENVIRONMENT = configService.get<string>('NODE_ENV', 'Development');

  await app.listen(PORT);
  console.log(
    `Application is running on port ${PORT}, Environmet: ${ENVIRONMENT}, Test: http://localhost:3000/`,
  );
}
void bootstrap();
