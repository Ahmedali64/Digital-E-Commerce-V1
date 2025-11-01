import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class ApplyDiscountDto {
  @ApiProperty({
    example: 'SUMMER2024',
    description: 'Discount code',
  })
  @IsString()
  code: string;
}
