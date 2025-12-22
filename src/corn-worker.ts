import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { ScheduledTasksService } from './modules/schedule-tasks/schedule-tasks.service';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('CronWorker');

  logger.log('Starting Corn Worker StandAlone APP');

  const app = await NestFactory.createApplicationContext(AppModule);

  const tasks = app.get(ScheduledTasksService);

  try {
    logger.log('Cron Worker is running and waiting for scheduled tasks');
    logger.log('Scheduled tasks:');
    await tasks.cleanupExpiredSales();
    await tasks.permanentlyDeleteOldProducts();
    await tasks.cleanupExpiredCarts();
  } catch {
    await app.close();
  }
}

void bootstrap();
