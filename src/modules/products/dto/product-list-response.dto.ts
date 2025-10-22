import { ApiProperty } from '@nestjs/swagger';
import { ProductDto } from './product.dto';
class PaginationDto {
  @ApiProperty({ example: 1 })
  page: number;
  @ApiProperty({ example: 12 })
  limit: number;
  @ApiProperty({ example: 100 })
  total: number;
  @ApiProperty({ example: 9 })
  totalPages: number;
}
export class ProductListResponseDto {
  @ApiProperty({ type: [ProductDto] })
  products: ProductDto[];
  @ApiProperty({ type: PaginationDto })
  pagination: PaginationDto;
}
