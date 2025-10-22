import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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
