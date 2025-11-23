/**
 * We get the user from JWT token (they're logged in)
 * We get cart items from their existing cart in DB
 * Only thing they can optionally provide is a discount code
 */
import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateOrderDto {
  @ApiPropertyOptional({
    description: 'Discount code to apply',
    example: 'SUMMER2024',
  })
  @IsOptional()
  @IsString()
  discountCode?: string;
}
