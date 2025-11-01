import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class UpdateCartItemDto {
  @ApiProperty({
    example: 2,
    description: 'New quantity',
    minimum: 0,
    maximum: 10,
  })
  @Type(() => Number)
  @IsInt()
  @Min(0, { message: 'Quantity must be at least 0 (0 to remove)' })
  @Max(10, { message: 'Maximum 10 items per product' })
  quantity: number;
}
