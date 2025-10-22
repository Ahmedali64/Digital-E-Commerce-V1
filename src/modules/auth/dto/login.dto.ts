import { Transform } from 'class-transformer';
import { IsEmail, IsString } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toLowerCase().trim() : '',
  )
  email: string;

  @IsString({ message: 'Password is required' })
  password: string;
}
