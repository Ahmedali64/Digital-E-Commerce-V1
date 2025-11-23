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
  @ApiProperty()
  message: string;

  @ApiProperty()
  order: OrderResponseDto;

  @ApiProperty()
  paymentUrl: string;
}
