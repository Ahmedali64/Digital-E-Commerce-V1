import { ApiProperty } from '@nestjs/swagger';
import { CartItemDto } from './cart-item.dto';

export class CartDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty({ type: [CartItemDto] })
  items: CartItemDto[];

  @ApiProperty({ description: 'Subtotal before discounts' })
  subtotal: number;

  @ApiProperty({ description: 'Applied discount code', nullable: true })
  discountCode: string | null;

  @ApiProperty({ description: 'Discount amount' })
  discountAmount: number;

  @ApiProperty({ description: 'Final total after discounts' })
  total: number;

  @ApiProperty({ description: 'Total number of items (books)' })
  itemCount: number;

  @ApiProperty()
  expiresAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
