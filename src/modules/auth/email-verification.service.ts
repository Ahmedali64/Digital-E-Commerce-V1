import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { randomBytes } from 'crypto';

@Injectable()
export class EmailVerificationService {
  private readonly logger = new Logger(EmailVerificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

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

  generateVerificationToken(): string {
    return randomBytes(32).toString('hex');
  }

  // Helper: Generate token with expiry
  generateTokenWithExpiry(hoursValid: number = 24) {
    const token = this.generateVerificationToken();
    const expiry = new Date();
    expiry.setHours(expiry.getHours() + hoursValid);
    return { token, expiry };
  }
}
