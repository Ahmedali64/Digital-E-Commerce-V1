import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { PaymentModule } from '../payment/payment.module';
import { QueueModule } from '../queue/queue.module';

@Module({
  controllers: [WebhooksController],
  imports: [PaymentModule, QueueModule],
})
export class WebhooksModule {}
