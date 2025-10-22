import { ApiProperty } from '@nestjs/swagger';
import { Decimal } from '@prisma/client/runtime/binary';

export class ProductDto {
  @ApiProperty({ example: 'd9a7b5e4-0e7d-4f68-89d3-0f7ef84f6f92' })
  id: string;

  @ApiProperty({ example: 'Clean Code' })
  title: string;

  @ApiProperty({ example: 'Robert C. Martin' })
  authorName: string;

  @ApiProperty({
    example: 'A book about writing clean, maintainable, and efficient code.',
    required: false,
  })
  description: string | null;

  @ApiProperty({ example: '978-0-306-40615-7', required: false })
  isbn: string | null;

  @ApiProperty({
    example: {
      name: 'Programming',
      slug: 'programming',
      description: 'Books about coding best practices',
    },
  })
  category: {
    name: string;
    slug: string;
    description: string | null;
  };

  @ApiProperty({ example: 299.99 })
  price: Decimal;

  @ApiProperty({ example: 20, required: false })
  discountPercentage: number | null;

  @ApiProperty({ example: '2025-12-31T23:59:59.000Z', required: false })
  saleEndsAt: Date | null;

  @ApiProperty({
    example: 'https://cdn.example.com/uploads/books/clean-code-cover.jpg',
  })
  coverImage: string;

  @ApiProperty({
    example: 'https://cdn.example.com/uploads/books/clean-code.pdf',
  })
  pdfFile: string;

  @ApiProperty({ example: 464, required: false })
  pageCount: number | null;

  @ApiProperty({ example: 'ENGLISH' })
  language: string;

  @ApiProperty({ example: true })
  isPublished: boolean;

  @ApiProperty({ example: '2025-01-01T00:00:00.000Z', required: false })
  publishedAt: Date | null;

  @ApiProperty({ example: 2008, required: false })
  publishedYear: number | null;

  @ApiProperty({ example: '2025-10-10T15:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2025-10-10T15:00:00.000Z' })
  updatedAt: Date;
}
