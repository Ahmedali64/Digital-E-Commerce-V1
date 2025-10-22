import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length } from 'class-validator';
import { IsStrongPassword } from 'src/common/decorators/is-strong-password.decorator';

export class RegisterDto {
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toLowerCase().trim() : '',
  )
  email: string;

  @IsString()
  @Length(8, 128, { message: 'Password must be between 8 and 128 characters' })
  @IsStrongPassword()
  password: string;

  @IsString()
  @Length(2, 50, { message: 'First name must be between 2 and 50 characters' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : ''))
  firstName: string;

  @IsString()
  @Length(2, 50, { message: 'Last name must be between 2 and 50 characters' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : ''))
  lastName: string;
}
