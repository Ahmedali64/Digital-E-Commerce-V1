import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';
import { getErrorMessage } from 'src/common/utils/error.util';

export type TokenPayload = {
  sub: string;
  email: string;
  role: Role;
};

export interface Tokens {
  access_token: string;
  refresh_token: string;
}

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  generateTokens(userId: string, email: string, role: string): Tokens {
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

  async storeRefreshToken(userId: string, refreshToken: string): Promise<void> {
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

  async validateAndGetRefreshToken(refreshToken: string) {
    const payload = this.verifyRefreshToken(refreshToken);

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

    return storedToken;
  }

  verifyRefreshToken(refreshToken: string): TokenPayload {
    let payload: TokenPayload;
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

    return payload;
  }

  async invalidateAllUserTokens(userId: string): Promise<void> {
    await this.prisma.refreshToken.deleteMany({
      where: { userId },
    });
    this.logger.log(`All refresh tokens invalidated for user: ${userId}`);
  }
}
