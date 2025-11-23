import { ApiProperty } from '@nestjs/swagger';
import { OrderStatus } from '@prisma/client';

export class OrderItemResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  authorName: string;

  @ApiProperty()
  price: number;

  @ApiProperty()
  pdfFile: string;
}

export class OrderResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  subtotal: number;

  @ApiProperty()
  discountAmount: number;

  @ApiProperty()
  total: number;

  @ApiProperty({ enum: OrderStatus })
  status: OrderStatus;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ type: [OrderItemResponseDto] })
  items: OrderItemResponseDto[];

  @ApiProperty({ required: false, nullable: true })
  discountCodeUsed?: string | null;

  @ApiProperty({ required: false, nullable: true })
  paidAt?: Date | null;
}

export class CreateOrderResponseDto {
  @ApiProperty({
    example: 'Order created successfully. Redirect user to payment URL.',
  })
  message: string;

  @ApiProperty({ type: OrderResponseDto })
  order: OrderResponseDto;

  @ApiProperty({
    example:
      'https://accept.paymob.com/api/acceptance/iframes/123?payment_token=xyz',
    description: 'URL to redirect user for payment',
  })
  paymentUrl: string;
}
