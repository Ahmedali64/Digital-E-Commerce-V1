import { ApiProperty } from '@nestjs/swagger';
import { ProductDto } from './product.dto';

export class CreateProductResponseDto {
  @ApiProperty({ example: 'Product created successfully' })
  message: string;

  @ApiProperty({ type: () => ProductDto })
  product: ProductDto;

  @ApiProperty({ example: 239.99 })
  priceAfterDiscount: number;
}
