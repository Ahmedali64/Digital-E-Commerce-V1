import { Module } from '@nestjs/common';
import { CartService } from './cart.service';
import { CartController } from './cart.controller';
import { DiscountController } from './discount.controller';
import { DiscountService } from './discount.service';

@Module({
  providers: [CartService, DiscountService],
  controllers: [CartController, DiscountController],
  exports: [CartService, DiscountService],
})
export class CartModule {}
