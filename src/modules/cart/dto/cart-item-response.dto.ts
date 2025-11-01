import { ApiProperty } from '@nestjs/swagger';

export class CartItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  productId: string;

  @ApiProperty()
  productTitle: string;

  @ApiProperty()
  productSlug: string;

  @ApiProperty()
  coverImage: string;

  @ApiProperty({ description: 'Price when added to cart' })
  priceAtAdd: number;

  @ApiProperty({ description: 'Current product price' })
  currentPrice: number;

  @ApiProperty({ description: 'Current discount percentage if on sale' })
  currentDiscount: number | null;
}
