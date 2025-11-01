import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateDiscountCodeDto {
  @ApiProperty({
    example: 'SUMMER2024',
    description: 'Unique discount code',
  })
  @IsString()
  code: string;

  @ApiPropertyOptional({
    example: 'Summer sale - 20% off',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    enum: ['PERCENTAGE', 'FIXED_AMOUNT'],
    example: 'PERCENTAGE',
  })
  @IsString()
  discountType: 'PERCENTAGE' | 'FIXED_AMOUNT';

  @ApiProperty({
    example: 20,
    description: 'Discount value (percentage or fixed amount)',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  discountValue: number;

  @ApiPropertyOptional({
    example: 50,
    description: 'Minimum purchase amount',
  })
  @IsOptional()
  @Type(() => Number)
  minPurchase?: number;

  @ApiPropertyOptional({
    example: 100,
    description: 'Maximum discount amount (for percentage codes)',
  })
  @IsOptional()
  @Type(() => Number)
  maxDiscount?: number;

  @ApiPropertyOptional({
    example: 100,
    description: 'Total usage limit',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  usageLimit?: number;

  @ApiPropertyOptional({
    example: 1,
    description: 'Usage limit per user',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  perUserLimit?: number;

  @ApiPropertyOptional({
    example: '2025-12-31T23:59:59.000Z',
  })
  @IsOptional()
  @Type(() => Date)
  expiresAt?: Date;
}
