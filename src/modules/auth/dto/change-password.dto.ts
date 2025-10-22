import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length } from 'class-validator';
import { IsStrongPassword } from 'src/common/decorators/is-strong-password.decorator';

export class ChangePasswordDto {
  @ApiProperty({
    example: 'OldP@ssw0rd!',
    description: 'Current password',
  })
  @IsString()
  @IsNotEmpty({ message: 'Reset token is required' })
  token: string;

  @ApiProperty({
    example: 'NewP@ssw0rd!',
    description: 'New strong password (8-128 characters)',
    minLength: 8,
    maxLength: 128,
  })
  @IsString()
  @Length(8, 128, { message: 'Password must be between 8 and 128 characters' })
  @IsStrongPassword()
  newPassword: string;
}
