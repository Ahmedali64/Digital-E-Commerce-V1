import {
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
import { Prisma } from '@prisma/client';
import { formatError } from 'src/common/utils/error.util';
import { MailService } from '../mail/mail.service';
import { OAuthProfile } from 'src/common/types/oauth-profile.type';
import { TokenService } from './token.service';
import { EmailVerificationService } from './email-verification.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
    private readonly emailVerificationService: EmailVerificationService,
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

    // First user is an admin just for demo.
    const userCount = await this.prisma.user.count();
    const role = userCount === 0 ? 'ADMIN' : 'CUSTOMER';
    // 12 salt round is the recommended number for better performance and security
    const hashedPassword = await bcrypt.hash(dto.password, 12);

    const { token: verificationToken, expiry: tokenExpiry } =
      this.emailVerificationService.generateTokenWithExpiry();

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
          role,
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

  async login(dto: LoginDto) {
    this.logger.log(`Login attempt for email: ${dto.email}`);

    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      this.logger.warn(`Login failed - User not found: ${dto.email}`);

      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password!);

    if (!isPasswordValid) {
      this.logger.warn(`Login failed - Invalid password for: ${dto.email}`);

      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = this.tokenService.generateTokens(
      user.id,
      user.email,
      user.role,
    );

    await this.tokenService.storeRefreshToken(user.id, tokens.refresh_token);
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

    const storedToken =
      await this.tokenService.validateAndGetRefreshToken(refreshToken);

    const tokens = this.tokenService.generateTokens(
      storedToken.user.id,
      storedToken.user.email,
      storedToken.user.role,
    );

    await this.prisma.refreshToken.delete({
      where: { id: storedToken.id },
    });

    await this.tokenService.storeRefreshToken(
      storedToken.user.id,
      tokens.refresh_token,
    );

    this.logger.log(
      `Tokens refreshed successfully - User ID: ${storedToken.user.id}, Email: ${storedToken.user.email}`,
    );

    return tokens;
  }

  // Handle OAuth login (Google/GitHub)
  async handleOAuthLogin(profile: OAuthProfile) {
    this.logger.log(
      `OAuth login attempt - Provider: ${profile.provider}, Email: ${profile.email}`,
    );
    try {
      let user = await this.prisma.user.findUnique({
        where: {
          // These 2 rogether are unique as one ex (google-12345)
          provider_providerId: {
            provider: profile.provider,
            providerId: profile.providerId,
          },
        },
      });

      if (user) {
        this.logger.log(
          `Existing OAuth user logged in - ID: ${user.id}, Provider: ${profile.provider}`,
        );
      } else {
        const existingEmailUser = await this.prisma.user.findUnique({
          where: { email: profile.email },
        });
        if (existingEmailUser) {
          // Email exists but with different provider (local/google/github)
          this.logger.warn(
            `Email ${profile.email} already registered with provider: ${existingEmailUser.provider}`,
          );
          throw new ConflictException(
            `This email is already registered with ${existingEmailUser.provider || 'email/password'}. Please use that method to login.`,
          );
        }

        // login but without a password
        user = await this.prisma.user.create({
          data: {
            email: profile.email,
            firstName: profile.firstName,
            lastName: profile.lastName,
            provider: profile.provider,
            providerId: profile.providerId,
            avatar: profile.avatar,
            isEmailVerified: true,
            emailVerifiedAt: new Date(),
            password: null,
          },
        });

        this.logger.log(
          `New OAuth user created - ID: ${user.id}, Provider: ${profile.provider}, Email: ${profile.email}`,
        );
      }

      const tokens = this.tokenService.generateTokens(
        user.id,
        user.email,
        user.role,
      );

      return {
        message: 'Login successful',
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          avatar: user.avatar,
          provider: user.provider,
          role: user.role,
          isEmailVerified: user.isEmailVerified,
        },
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
      };
    } catch (error: unknown) {
      if (error instanceof ConflictException) {
        throw error;
      }

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          this.logger.warn(
            `OAuth login failed - Unique constraint violation: ${profile.email}`,
          );
          throw new ConflictException('User already exists');
        }
      }

      const { message, stack } = formatError(error);
      this.logger.error(
        `OAuth login failed for ${profile.email}: ${message}`,
        stack,
      );

      throw new InternalServerErrorException('OAuth login failed');
    }
  }
}
