import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDate,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

enum Language {
  ENGLISH = 'ENGLISH',
  ARABIC = 'ARABIC',
  FRENCH = 'FRENCH',
  SPANISH = 'SPANISH',
  GERMAN = 'GERMAN',
  OTHER = 'OTHER',
}

export class CreateProductDto {
  @ApiProperty({
    example: 'Clean Code',
    description: 'Book title',
    minLength: 2,
    maxLength: 50,
  })
  @IsString()
  @Length(2, 50, { message: 'Title must be between 2 and 50 characters' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : ''))
  title: string;

  @ApiProperty({
    example: 'Robert C. Martin',
    description: 'Author full name',
    minLength: 2,
    maxLength: 50,
  })
  @IsString()
  @Length(2, 50, { message: 'Author name must be between 2 and 50 characters' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : ''))
  authorName: string;

  @ApiProperty({
    example:
      '"Clean Code" by Robert C. Martin emphasizes the importance of writing readable and maintainable code.',
    description: 'Product description',
    minLength: 20,
    maxLength: 1000,
  })
  @IsString()
  @Length(20, 1000, {
    message: 'Description must be between 200 and 1000 characters',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : ''))
  description: string;

  @ApiPropertyOptional({
    example: '978-0-306-40615-7',
    description: 'International Standard Book Number (ISBN)',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : ''))
  @Matches(
    /^(?:ISBN(?:-1[03])?:? )?(?=[0-9X]{10}$|(?=(?:[0-9]+[- ]){3})[- 0-9X]{13}$|97[89][0-9]{10}$|(?=(?:[0-9]+[- ]){4})[- 0-9]{17}$)(?:97[89][- ]?)?[0-9]{1,5}[- ]?[0-9]+[- ]?[0-9]+[- ]?[0-9X]$/,
    {
      message: 'Invalid ISBN format',
    },
  )
  isbn?: string;

  @ApiProperty({
    example: 'b6a5e80d-b882-40c5-93a5-1c52cb5c7ab2',
    description: 'Category ID of the book',
  })
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : ''))
  categoryId: string;

  @ApiProperty({
    description: 'Product price in USD',
    example: 299.99,
    minimum: 0,
    maximum: 999.99,
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.99, { message: 'Minimum price is $0.99' })
  @Max(999.99, { message: 'Maximum price is $999.99' })
  price: number;

  @ApiPropertyOptional({
    description: 'Discount percentage (if applicable)',
    example: 20,
    minimum: 1,
    maximum: 99,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1, { message: 'Discount must be at least 1%' })
  @Max(99, { message: 'Discount cannot exceed 99%' })
  discountPercentage?: number;

  @ApiPropertyOptional({
    description: 'Discount end date',
    example: '2025-12-31T23:59:59.000Z',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  saleEndsAt?: Date;

  @ApiPropertyOptional({
    example: 464,
    description: 'Number of pages in the book',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  pageCount?: number;

  @ApiPropertyOptional({
    enum: Language,
    description: 'Book language',
    example: Language.ENGLISH,
    default: Language.ENGLISH,
  })
  @IsOptional()
  @IsEnum(Language)
  language?: Language = Language.ENGLISH;

  @ApiProperty({
    description: 'Whether the product is published',
    example: true,
  })
  @IsBoolean()
  isPublished: boolean;

  @ApiPropertyOptional({
    example: 2024,
    description: 'Year the book was published',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  publishedYear?: number;
}
