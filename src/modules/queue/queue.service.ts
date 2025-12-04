import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  // We make the clint that we will use to send emails
  constructor(
    private readonly prisma: PrismaService,
    @Inject('EMAIL_SERVICE') private client: ClientProxy,
  ) {}

  /**
   * Send payment receipt email job to queue
   * This doesn't send the email directly - it adds a job to the queue
   * A consumer (worker) will pick it up and process it
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async sendPaymentReceiptEmail(orderId: string): Promise<void> {
    try {
      this.logger.log(`Sending payment email job for order: ${orderId}`);

      // Here we are sending the orderID as a Data
      this.client.emit('payment_receipt_email', { orderId });

      this.logger.log(`Payment email job queued successfully: ${orderId}`);
    } catch (error) {
      this.logger.error(`Failed to queue payment email: ${orderId}`, error);
      throw error;
    }
  }
}
