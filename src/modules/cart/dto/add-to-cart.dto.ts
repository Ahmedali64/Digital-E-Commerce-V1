import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class AddToCartDto {
  @ApiProperty({
    example: 'b6a5e80d-b882-40c5-93a5-1c52cb5c7ab2',
    description: 'Product ID',
  })
  @IsString()
  productId: string;
}
