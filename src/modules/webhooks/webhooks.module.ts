import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { PaymentModule } from '../payment/payment.module';

@Module({
  controllers: [WebhooksController],
  imports: [PaymentModule],
})
export class WebhooksModule {}
