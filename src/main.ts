import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { HttpExceptionsFilter } from './common/filters/http-exception.filter';
import helmet from 'helmet';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import rateLimit from 'express-rate-limit';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Replace nest defalut logger with ours
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));

  const configService = app.get(ConfigService);
  const PORT = configService.get<number>('PORT', 3000);
  const ENVIRONMENT = configService.get<string>('NODE_ENV', 'Development');

  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP',
  });
  app.use(limiter);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip props that don't have decorators
      forbidNonWhitelisted: true, // Throw error if extra props sent
      transform: true, // Auto-transform payloads from object to DTO instances
    }),
  );

  // CORS_ORIGIN is the frontEnd url in .env file
  app.use(helmet());
  if (ENVIRONMENT === 'production') {
    app.enableCors({
      origin: configService.get<string>('CORS_ORIGIN'),
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    });
  } else {
    app.enableCors({
      origin: true, // Allow all origins in dev
      credentials: true,
    });
  }
  app.useGlobalFilters(new HttpExceptionsFilter());

  // ========== SWAGGER SETUP ==========
  const config = new DocumentBuilder()
    .setTitle('Digital E-Commerce')
    .setDescription('This is a documentation for my APIs')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);
  // ===================================

  // Graceful shutdown
  app.enableShutdownHooks();
  await app.listen(PORT);

  console.log(
    `Application is running on port ${PORT}, Environmet: ${ENVIRONMENT}, Test: http://localhost:3000/`,
  );
}
void bootstrap();
