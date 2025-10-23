import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { formatError, getErrorMessage } from 'src/common/utils/error.util';
import { FilesService } from '../files/files.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ScheduledTasksService {
  private readonly logger = new Logger(ScheduledTasksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fileUploadService: FilesService,
  ) {}
  /**
   * Clean up expired sales every day at midnight
   * Cron format: second minute hour day month dayOfWeek
   * 0 0 0 * * * = Every day at 00:00:00
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupExpiredSales() {
    this.logger.log('Starting cleanup of expired sales...');
    try {
      const result = await this.prisma.product.updateMany({
        where: {
          saleEndsAt: {
            lt: new Date(), // Less than current date (expired)
          },
          discountPercentage: {
            not: null, // Has a discount
          },
        },
        data: {
          discountPercentage: null,
          saleEndsAt: null,
        },
      });

      this.logger.log(
        `Expired sales cleanup completed: ${result.count} product(s) updated`,
      );
    } catch (error) {
      const { message, stack } = formatError(error);
      this.logger.error(
        `Failed to cleanup expired sales Message: ${message}`,
        stack,
      );
    }
  }
  /**
   * Clean up soft-deleted products older than 30 days
   * Permanently delete them from database
   */
  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async permanentlyDeleteOldProducts() {
    this.logger.log(
      'Starting permanent deletion of old soft-deleted products...',
    );

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    try {
      const productsToDelete = await this.prisma.product.findMany({
        where: {
          deletedAt: {
            lt: thirtyDaysAgo,
          },
        },
        select: {
          id: true,
          title: true,
          coverImage: true,
          pdfFile: true,
        },
      });

      if (productsToDelete.length === 0) {
        this.logger.log('No old products to permanently delete');
        return;
      }

      for (const product of productsToDelete) {
        try {
          await this.fileUploadService.deleteFile(product.coverImage);
          await this.fileUploadService.deleteFile(product.pdfFile);
        } catch (error) {
          const message = getErrorMessage(error);
          this.logger.warn(
            `Failed to delete files for product ${product.id}, message: ${message}`,
          );
        }
      }

      // Permanently delete from database
      const result = await this.prisma.product.deleteMany({
        where: {
          deletedAt: {
            lt: thirtyDaysAgo,
          },
        },
      });

      this.logger.log(
        `Permanently deleted ${result.count} old product(s): ${productsToDelete.map((p) => p.title).join(', ')}`,
      );
    } catch (error) {
      const { message, stack } = formatError(error);
      this.logger.error(
        `Failed to permanently delete old products: ${message}`,
        stack,
      );
    }
  }
}
