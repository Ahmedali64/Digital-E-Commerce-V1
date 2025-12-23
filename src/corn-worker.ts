import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { ScheduledTasksService } from './modules/schedule-tasks/schedule-tasks.service';
import { AppModule } from './app.module';
import { formatError } from './common/utils/error.util';

async function bootstrap() {
  const logger = new Logger('CronWorker');

  logger.log('Starting Corn Worker StandAlone APP');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
  });

  const tasks = app.get(ScheduledTasksService);
  try {
    logger.log('Cron Worker started successfully');
    try {
      await tasks.cleanupExpiredSales();
      logger.log('cleanupExpiredSales completed');
    } catch (error) {
      const { message, stack } = formatError(error);
      logger.error(
        `Failed cleanupExpiredSales, Message: ${message}, Stack: ${stack}`,
      );
    }

    try {
      await tasks.permanentlyDeleteOldProducts();
      logger.log('permanentlyDeleteOldProducts completed');
    } catch (error) {
      const { message, stack } = formatError(error);
      logger.error(
        `Failed permanentlyDeleteOldProducts, Message: ${message}, Stack: ${stack}`,
      );
    }

    try {
      await tasks.cleanupExpiredCarts();
      logger.log('cleanupExpiredCarts completed');
    } catch (error) {
      const { message, stack } = formatError(error);
      logger.error(
        `Failed Failed cleanupExpiredCarts, Message: ${message}, Stack: ${stack}`,
      );
    }
  } catch (error) {
    logger.error('Fatal error in cron worker setup:', error);
  } finally {
    // Always close the app after we finsih
    await app.close();
    logger.log('Cron Worker shut down');
  }
}
// Termination signal from ex docker
process.on('SIGTERM', () => process.exit(0));
// Termination singal from user ex ctrl + c
process.on('SIGINT', () => process.exit(0));
void bootstrap();
