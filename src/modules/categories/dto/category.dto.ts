import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
export class CategoryDto {
  @ApiProperty({ example: 'd9a7b5e4-0e7d-4f68-89d3-0f7ef84f6f92' })
  id: string;

  @ApiProperty({ example: 'Programming' })
  name: string;

  @ApiProperty({ example: 'programming' })
  slug: string;

  @ApiPropertyOptional({
    example: 'Books about software development and coding',
  })
  description: string | null;

  @ApiPropertyOptional({
    example: '/uploads/categories/programming.jpg',
  })
  image: string | null;
  @ApiProperty({ example: '2025-10-15T10:00:00.000Z' })
  createdAt: Date;
  @ApiProperty({ example: '2025-10-15T10:00:00.000Z' })
  updatedAt: Date;
}
