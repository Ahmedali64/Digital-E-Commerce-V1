import { ApiProperty } from '@nestjs/swagger';
import { CategoryDto } from './category.dto';
export class CategoryResponseDto {
  @ApiProperty({ example: 'Category created successfully' })
  message: string;
  @ApiProperty({ type: CategoryDto })
  category: CategoryDto;
}
