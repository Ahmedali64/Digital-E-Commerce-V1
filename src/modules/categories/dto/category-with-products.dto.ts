import { ApiProperty } from '@nestjs/swagger';
import { CategoryDto } from './category.dto';
class ProductSummaryDto {
  @ApiProperty()
  id: string;
  @ApiProperty()
  title: string;
  @ApiProperty()
  slug: string;
  @ApiProperty()
  authorName: string;
  @ApiProperty()
  price: number;
  @ApiProperty()
  coverImage: string;
  @ApiProperty()
  imageSize: number;
  @ApiProperty()
  imageOriginal: string;
  @ApiProperty()
  isPublished: boolean;
}
export class CategoryWithProductsDto extends CategoryDto {
  @ApiProperty({ type: [ProductSummaryDto] })
  products: ProductSummaryDto[];
  @ApiProperty({ example: 25 })
  productCount: number;
}
