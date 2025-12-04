import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import { PaymentService } from '../payment/payment.service';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStatus, PaymentStatus, Prisma } from '@prisma/client';
import type { PaymobWebhookData } from '../payment/interfaces/payment.interface';

@Controller('webhooks')
@ApiTags('Webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    private readonly paymentService: PaymentService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('paymob')
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  /**
   * payload is the data that paymob sent to us to verify that user payment went successfully
   */
  async handlePaymobWebhook(@Body() payload: PaymobWebhookData) {
    this.logger.log('Paymob webhook received');

    const transaction = payload.obj;

    // Step 1: Verify HMAC signature
    const isValid = this.paymentService.verifyWebhookSignature({
      amount_cents: transaction.amount_cents,
      created_at: transaction.created_at,
      currency: transaction.currency,
      error_occured: transaction.error_occured,
      has_parent_transaction: transaction.has_parent_transaction,
      id: transaction.id,
      integration_id: transaction.integration_id,
      is_3d_secure: transaction.is_3d_secure,
      is_auth: transaction.is_auth,
      is_capture: transaction.is_capture,
      is_refunded: transaction.is_refunded,
      is_standalone_payment: transaction.is_standalone_payment,
      is_voided: transaction.is_voided,
      order: transaction.order,
      owner: transaction.owner,
      pending: transaction.pending,
      source_data_pan: transaction.source_data.pan,
      source_data_sub_type: transaction.source_data.sub_type,
      source_data_type: transaction.source_data.type,
      success: transaction.success,
      hmac: payload.hmac,
    });

    if (!isValid) {
      this.logger.error('Invalid webhook signature - possible attack attempt');
      throw new UnauthorizedException('Invalid signature');
    }

    this.logger.log('Webhook signature verified ✓');

    const ourOrderId = transaction.order.merchant_order_id;

    if (!ourOrderId) {
      this.logger.error('No merchant_order_id in webhook');
      return { message: 'No order ID provided' };
    }

    const order = await this.prisma.order.findUnique({
      where: { id: ourOrderId },
      include: { payment: true },
    });

    if (!order) {
      this.logger.error(`Order not found: ${ourOrderId}`);
      return { message: 'Order not found' };
    }

    if (order.payment?.webhookReceived) {
      this.logger.warn(`Webhook already processed for order: ${ourOrderId}`);
      return { message: 'Already processed' };
    }

    // Convert payload to JsonValue properly
    const webhookData = JSON.parse(
      JSON.stringify(payload),
    ) as Prisma.InputJsonValue;

    const errorMessage =
      typeof transaction.data?.message === 'string'
        ? transaction.data.message
        : 'Payment failed';

    //Here
    if (transaction.success) {
      this.logger.log(`Payment succeeded for order: ${ourOrderId}`);

      await this.prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: ourOrderId },
          data: {
            status: OrderStatus.PAID,
            paidAt: new Date(),
          },
        });

        await tx.payment.update({
          where: { orderId: ourOrderId },
          data: {
            status: PaymentStatus.COMPLETED,
            paymobTransactionId: transaction.id.toString(),
            paymobOrderId: transaction.order.id.toString(),
            paymentMethod: this.mapPaymentMethod(transaction.source_data.type),
            paidAt: new Date(),
            webhookReceived: true,
            webhookData: webhookData,
          },
        });
      });

      this.logger.log(`Order ${ourOrderId} marked as PAID ✓`);
    } else {
      this.logger.warn(`Payment failed for order: ${ourOrderId}`);

      await this.prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: ourOrderId },
          data: { status: OrderStatus.FAILED },
        });

        await tx.payment.update({
          where: { orderId: ourOrderId },
          data: {
            status: PaymentStatus.FAILED,
            failureReason: errorMessage,
            webhookReceived: true,
            webhookData: webhookData,
          },
        });
      });

      this.logger.log(`Order ${ourOrderId} marked as FAILED`);
    }

    return { message: 'Webhook processed' };
  }

  private mapPaymentMethod(type: string): 'CARD' | 'MOBILE_WALLET' | 'CASH' {
    const lowerType = type.toLowerCase();
    if (lowerType.includes('card')) {
      return 'CARD';
    }
    if (lowerType.includes('wallet')) {
      return 'MOBILE_WALLET';
    }
    return 'CASH';
  }
}
