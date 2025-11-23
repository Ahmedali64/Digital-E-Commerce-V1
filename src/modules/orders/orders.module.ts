import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { PaymentModule } from '../payment/payment.module';

@Module({
  providers: [OrdersService],
  controllers: [OrdersController],
  exports: [OrdersService],
  imports: [PaymentModule],
})
export class OrdersModule {}
