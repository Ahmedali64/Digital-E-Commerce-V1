import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { EmailVerificationService } from './email-verification.service';
import * as bcrypt from 'bcrypt';
import { TokenService } from './token.service';

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly emailVerificationService: EmailVerificationService,
    private readonly tokenService: TokenService,
  ) {}

  async requestPasswordReset(email: string) {
    this.logger.log(`Password reset request for email: ${email}`);
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      this.logger.warn(
        `Password reset requested for non-existent email: ${email}`,
      );
      return {
        message: 'If that email exists, a password reset link has been sent.',
      };
    }

    const resetToken =
      this.emailVerificationService.generateVerificationToken();

    const tokenExpiry = new Date();
    tokenExpiry.setHours(tokenExpiry.getHours() + 1);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: resetToken,
        passwordResetExpires: tokenExpiry,
      },
    });

    this.logger.log(`Password reset token generated for user: ${user.id}`);

    try {
      await this.mailService.sendPasswordResetEmail(
        user.email,
        resetToken,
        user.firstName,
      );
      this.logger.log(`Password reset email sent to: ${user.email}`);
    } catch (error) {
      this.logger.error(
        `Failed to send password reset email to ${user.email}`,
        error,
      );
    }

    return {
      message: 'If that email exists, a password reset link has been sent.',
    };
  }

  async resetPassword(token: string, newPassword: string) {
    this.logger.log(`Password reset attempt with token: ${token}`);
    const user = await this.prisma.user.findUnique({
      where: { passwordResetToken: token },
    });

    if (!user) {
      this.logger.warn(`Invalid password reset token: ${token}`);
      throw new BadRequestException('Invalid or expired reset token');
    }

    const now = new Date();
    if (user.passwordResetExpires && user.passwordResetExpires < now) {
      this.logger.warn(
        `Password reset token expired for user: ${user.id} - Expired at: ${String(user.passwordResetExpires)}`,
      );
      throw new BadRequestException(
        'Reset token has expired. Please request a new password reset.',
      );
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    });

    this.logger.log(`Password reset successful for user: ${user.id}`);
    // Delete all refresh tokens to log him out from all devices so he log again with the new password
    await this.tokenService.invalidateAllUserTokens(user.id);

    this.logger.log(`All refresh tokens invalidated for user: ${user.id}`);

    return {
      message:
        'Password reset successfully! You can now login with your new password.',
    };
  }
}
