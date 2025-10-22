import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { RegisterDto } from './dto/register.dto';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Prisma, Role } from '@prisma/client';
import { formatError, getErrorMessage } from 'src/common/utils/error.util';
import { MailService } from '../mail/mail.service';
import { randomBytes } from 'crypto';

export type PayloadType = {
  sub: string;
  email: string;
  role: Role;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
  ) {}
  async register(dto: RegisterDto) {
    this.logger.log(`Registration attempt for email: ${dto.email}`);

    const userExist = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (userExist) {
      this.logger.warn(
        `Registration failed - User already exists: ${dto.email}`,
      );
      throw new ConflictException('User already exist');
    }
    // 12 salt round is the recommended number for better performance and security
    const hashedPassword = await bcrypt.hash(dto.password, 12);

    const verificationToken = this.generateVerificationToken();
    const tokenExpiry = new Date();
    tokenExpiry.setHours(tokenExpiry.getHours() + 24);
    try {
      // We used select here to get user data without the password
      const userWithoutPassword = await this.prisma.user.create({
        data: {
          email: dto.email,
          password: hashedPassword,
          firstName: dto.firstName,
          lastName: dto.lastName,
          emailVerificationToken: verificationToken,
          emailVerificationTokenExpiry: tokenExpiry,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isEmailVerified: true,
          emailVerificationTokenExpiry: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      this.logger.log(
        `User registered successfully - ID: ${userWithoutPassword.id}, Email: ${userWithoutPassword.email}`,
      );

      try {
        await this.mailService.sendVerificationEmail(
          userWithoutPassword.email,
          verificationToken,
          userWithoutPassword.firstName,
        );

        this.logger.log(
          `Verification email sent - ID: ${userWithoutPassword.id}, Email: ${userWithoutPassword.email}`,
        );
      } catch (emailError) {
        this.logger.error(
          `Failed to send verification email to ${userWithoutPassword.email}`,
          emailError,
        );
        // User is still registered, they can use resend endpoint
      }

      return {
        message:
          'Registration successful! Please check your email to verify your account',
        userWithoutPassword,
      };
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          this.logger.warn(
            `Registration failed - Unique constraint violation: ${dto.email}`,
          );
          throw new ConflictException('User already exists');
        }
      }

      const { message, stack } = formatError(error);
      this.logger.error(
        `Registration failed for ${dto.email}: ${message}`,
        stack,
      );

      throw new InternalServerErrorException('Registration failed');
    }
  }

  async verifyEmail(token: string) {
    this.logger.log(`Email verification attempt started with token: ${token}`);
    const user = await this.prisma.user.findUnique({
      where: { emailVerificationToken: token },
    });

    if (!user) {
      this.logger.warn(`User token i is not valid token: ${token}`);
      throw new BadRequestException('Invalid or expired verification token');
    }

    if (user.isEmailVerified) {
      this.logger.warn(`User emal already cerified Email: ${user.email}`);
      throw new BadRequestException('Email already verified');
    }

    const now = new Date();
    if (
      user.emailVerificationTokenExpiry &&
      user.emailVerificationTokenExpiry < now
    ) {
      this.logger.warn(
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        `Verification token expired for email: ${user.email} - Expired at: ${user.emailVerificationTokenExpiry}`,
      );
      throw new BadRequestException(
        'Verification token has expired. Please request a new verification email.',
      );
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        isEmailVerified: true,
        emailVerifiedAt: new Date(),
        emailVerificationToken: null,
        emailVerificationTokenExpiry: null,
      },
    });

    this.logger.log(
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      `Email verified successfully At: ${updatedUser.emailVerifiedAt} - Email: ${user.email} `,
    );
    return {
      message: 'Email verified successfully! You can now login.',
    };
  }

  async resendVerificationEmail(email: string) {
    this.logger.log(`Resend verification email attempt for email: ${email}`);
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      this.logger.warn(`User with Eail: ${email} was not found`);
      throw new BadRequestException('User not found');
    }

    if (user.isEmailVerified) {
      this.logger.warn(`User with Eail: ${email} is already verified`);
      throw new BadRequestException('Email already verified');
    }

    const newToken = this.generateVerificationToken();
    const tokenExpiry = new Date();
    tokenExpiry.setHours(tokenExpiry.getHours() + 24);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationToken: newToken,
        emailVerificationTokenExpiry: tokenExpiry,
      },
    });

    this.logger.log(`Verification token updated successfully`);

    await this.mailService.sendVerificationEmail(
      user.email,
      newToken,
      user.firstName,
    );
    this.logger.log(
      `Verification token sent successfully to email ${user.email}`,
    );
    return {
      message: 'Verification email sent! Please check your inbox.',
    };
  }

  async login(dto: LoginDto) {
    this.logger.log(`Login attempt for email: ${dto.email}`);

    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      this.logger.warn(`Login failed - User not found: ${dto.email}`);

      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);

    if (!isPasswordValid) {
      this.logger.warn(`Login failed - Invalid password for: ${dto.email}`);

      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = this.generateTokens(user.id, user.email, user.role);

    await this.storeRefreshToken(user.id, tokens.refresh_token);
    this.logger.log(
      `User logged in successfully - ID: ${user.id}, Email: ${user.email}`,
    );
    return tokens;
  }

  async logout(refreshToken: string) {
    this.logger.log('Logout attempt');

    const deleted = await this.prisma.refreshToken.deleteMany({
      where: {
        token: refreshToken,
      },
    });

    if (deleted.count === 0) {
      this.logger.warn('Logout failed - Refresh token not found');

      throw new UnauthorizedException('Refresh token not found');
    }
    this.logger.log(
      `User logged out successfully - ${deleted.count} token(s) removed`,
    );

    return {
      message: 'Logged out successfully',
    };
  }

  async logoutAll(userId: string) {
    this.logger.log(`Logout all devices attempt for user ID: ${userId}`);

    const deleted = await this.prisma.refreshToken.deleteMany({
      where: {
        userId: userId,
      },
    });
    this.logger.log(
      `User logged out from all devices - ID: ${userId}, Tokens removed: ${deleted.count}`,
    );
    return {
      message: 'Logged out from all devices successfully',
    };
  }

  async refreshTokens(refreshToken: string) {
    this.logger.log('Token refresh attempt');

    let payload: PayloadType;
    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      this.logger.warn(
        `Token refresh failed - Invalid refresh token: ${message}`,
      );
      throw new UnauthorizedException('Invalid refresh token');
    }

    const storedToken = await this.prisma.refreshToken.findFirst({
      where: {
        token: refreshToken,
        userId: payload.sub,
      },
      include: {
        user: true,
      },
    });

    if (!storedToken) {
      this.logger.warn(
        `Token refresh failed - Refresh token not found for user: ${payload.email}`,
      );
      throw new UnauthorizedException('Refresh token not found');
    }

    if (new Date() > storedToken.expiresAt) {
      await this.prisma.refreshToken.delete({
        where: { id: storedToken.id },
      });
      this.logger.warn(
        `Token refresh failed - Token expired for user: ${storedToken.user.email}`,
      );
      throw new UnauthorizedException('Refresh token expired');
    }

    const tokens = this.generateTokens(
      storedToken.user.id,
      storedToken.user.email,
      storedToken.user.role,
    );

    await this.prisma.refreshToken.delete({
      where: { id: storedToken.id },
    });
    await this.storeRefreshToken(storedToken.user.id, tokens.refresh_token);
    this.logger.log(
      `Tokens refreshed successfully - User ID: ${storedToken.user.id}, Email: ${storedToken.user.email}`,
    );
    return tokens;
  }

  // Helper functions

  private generateTokens(userId: string, email: string, role: string) {
    const payload = { sub: userId, email, role };

    const accessToken = this.jwtService.sign(payload);

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.get('JWT_REFRESH_EXPIRATION'),
    });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }

  private async storeRefreshToken(userId: string, refreshToken: string) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId,
        expiresAt,
      },
    });
  }

  private generateVerificationToken(): string {
    return randomBytes(32).toString('hex');
  }
}
