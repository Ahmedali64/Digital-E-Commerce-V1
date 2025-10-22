import { ApiProperty } from '@nestjs/swagger';

export class ErrorResponseDto {
  @ApiProperty({
    example: false,
    description: 'Indicates the request was unsuccessful',
  })
  success: boolean;

  @ApiProperty({
    example: 'User already exist',
    description: 'Error message describing what went wrong',
  })
  message: string;

  @ApiProperty({
    example: 409,
    description: 'HTTP status code',
  })
  statusCode: number;

  @ApiProperty({
    example: '2025-10-07T10:30:00.000Z',
    description: 'Timestamp when the error occurred',
  })
  timestamp: string;

  @ApiProperty({
    example: '/api/auth/register',
    description: 'Request path that triggered the error',
  })
  path: string;
}
