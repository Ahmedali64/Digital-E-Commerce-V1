import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, Length } from 'class-validator';
import { Transform } from 'class-transformer';
export class CreateCategoryDto {
  @ApiProperty({
    example: 'Programming',
    description: 'Category name',
    minLength: 2,
    maxLength: 50,
  })
  @IsString()
  @Length(2, 50, { message: 'Name must be between 2 and 50 characters' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : ''))
  name: string;

  @ApiPropertyOptional({
    example: 'Books about software development, coding, and computer science',
    description: 'Category description',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @Length(10, 500, {
    message: 'Description must be between 10 and 500 characters',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : ''))
  description?: string;

  @ApiPropertyOptional({
    example: '/uploads/categories/programming.jpg',
    description: 'Category image URL',
  })
  @IsOptional()
  @IsString()
  image?: string;
}
