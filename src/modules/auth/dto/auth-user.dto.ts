import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class AuthUserDto {
  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'User ID',
  })
  id: string;

  @ApiProperty({
    example: 'john@example.com',
    description: 'User email',
  })
  email: string;

  @ApiProperty({
    example: 'John',
    description: 'User first name',
  })
  firstName: string;

  @ApiProperty({
    example: 'Doe',
    description: 'User last name',
  })
  lastName: string;

  @ApiProperty({
    example: 'CUSTOMER',
    enum: Role,
    description: 'User role',
  })
  role: Role;

  @ApiProperty({
    example: true,
    description: 'Is user email verified or no',
  })
  isEmailVerified: boolean;

  @ApiProperty({
    example: '2024-01-01T00:00:00.000Z',
    description: 'Account creation date',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2024-01-01T00:00:00.000Z',
    description: 'Account update date',
  })
  updatedAt: Date;
}
