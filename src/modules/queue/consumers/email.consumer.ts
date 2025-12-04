import { Controller, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventPattern, Payload } from '@nestjs/microservices';
import { MailService } from '../../mail/mail.service';

interface PaymentEmailPayload {
  orderId: string;
}
// A controller to listen to the queue that we made
@Controller()
export class EmailConsumer {
  private readonly logger = new Logger(EmailConsumer.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  /**
   * Listen for 'payment_receipt_email' events from RabbitMQ
   * This method runs automatically when a message arrives
   * Payload extracts the data from the message as {}
   */
  @EventPattern('payment_receipt_email')
  async handlePaymentReceiptEmail(@Payload() payload: PaymentEmailPayload) {
    this.logger.log(`Received payment email job for order: ${payload.orderId}`);

    try {
      // Get order details
      const order = await this.prisma.order.findUnique({
        where: { id: payload.orderId },
        include: {
          items: true,
          user: true,
          payment: true,
        },
      });

      if (!order) {
        this.logger.error(`Order not found: ${payload.orderId}`);
        return;
      }

      if (order.status !== 'PAID') {
        this.logger.warn(
          `Order not paid yet: ${payload.orderId}, status: ${order.status}`,
        );
        return;
      }

      this.logger.log(`Sending payment receipt email to: ${order.user.email}`);

      await this.mailService.sendPaymentReceiptEmail(order);

      this.logger.log(
        `Payment receipt email sent for order: ${payload.orderId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to process payment email for order: ${payload.orderId}`,
        error,
      );
      throw error;
    }
  }
}
