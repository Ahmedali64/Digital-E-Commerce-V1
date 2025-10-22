import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class VerifyEmailDto {
  @ApiProperty({
    example: 'a3f5d9e2b8c1...',
    description: 'Email verification token',
  })
  @IsString()
  @IsNotEmpty({ message: 'Verification token is required' })
  token: string;
}
