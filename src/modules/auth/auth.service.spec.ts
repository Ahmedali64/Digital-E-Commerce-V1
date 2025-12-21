/* eslint-disable @typescript-eslint/unbound-method */
import { Test } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { MailService } from '../mail/mail.service';
import * as bcrypt from 'bcrypt';
import {
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Role } from '@prisma/client';

// Mock bcrypt
jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let prismaService: PrismaService;
  let jwtService: JwtService;
  let mailService: MailService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              count: jest.fn(),
            },
            refreshToken: {
              create: jest.fn(),
              deleteMany: jest.fn(),
              findFirst: jest.fn(),
              delete: jest.fn(),
            },
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(),
            verify: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, string> = {
                JWT_SECRET: 'test-secret',
                JWT_REFRESH_SECRET: 'test-refresh-secret',
                JWT_EXPIRATION: '15m',
                JWT_REFRESH_EXPIRATION: '7d',
                FRONTEND_URL: 'http://localhost:3000',
              };
              return config[key];
            }),
          },
        },
        {
          provide: MailService,
          useValue: {
            sendVerificationEmail: jest.fn(),
            sendPasswordResetEmail: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prismaService = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);
    mailService = module.get<MailService>(MailService);

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('register', () => {
    const registerDto = {
      email: 'test@example.com',
      password: 'Test@1234',
      firstName: 'John',
      lastName: 'Doe',
    };

    it('should register a new user successfully', async () => {
      // Arrange
      const hashedPassword = 'hashed_password_123';
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prismaService.user.count as jest.Mock).mockResolvedValue(5); // Not first user
      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);
      (prismaService.user.create as jest.Mock).mockResolvedValue({
        id: 'user-123',
        email: registerDto.email,
        firstName: registerDto.firstName,
        lastName: registerDto.lastName,
        role: Role.CUSTOMER,
        isEmailVerified: false,
        emailVerificationTokenExpiry: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      (mailService.sendVerificationEmail as jest.Mock).mockResolvedValue(
        undefined,
      );

      // Act
      const result = await service.register(registerDto);

      // Assert
      expect(result).toHaveProperty('message');
      expect(result.message).toContain('Registration successful');
      expect(result.userWithoutPassword).toBeDefined();
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: registerDto.email },
      });
      expect(bcrypt.hash).toHaveBeenCalledWith(registerDto.password, 12);
      expect(mailService.sendVerificationEmail).toHaveBeenCalled();
    });

    it('should make first user an ADMIN', async () => {
      // Arrange
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prismaService.user.count as jest.Mock).mockResolvedValue(0); // First user
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed_password');
      (prismaService.user.create as jest.Mock).mockResolvedValue({
        id: 'user-123',
        email: registerDto.email,
        firstName: registerDto.firstName,
        lastName: registerDto.lastName,
        role: Role.ADMIN,
        isEmailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Act
      await service.register(registerDto);

      // Assert
      expect(prismaService.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          data: expect.objectContaining({
            role: Role.ADMIN,
          }),
        }),
      );
    });

    it('should throw ConflictException if user already exists', async () => {
      // Arrange
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'existing-user',
        email: registerDto.email,
      });

      // Act & Assert
      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.register(registerDto)).rejects.toThrow(
        'User already exist',
      );
    });

    it('should handle email sending failure gracefully', async () => {
      // Arrange
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prismaService.user.count as jest.Mock).mockResolvedValue(1);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed_password');
      (prismaService.user.create as jest.Mock).mockResolvedValue({
        id: 'user-123',
        email: registerDto.email,
        firstName: registerDto.firstName,
        lastName: registerDto.lastName,
        role: Role.CUSTOMER,
        isEmailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      (mailService.sendVerificationEmail as jest.Mock).mockRejectedValue(
        new Error('Email service error'),
      );

      // Act
      const result = await service.register(registerDto);

      // Assert - Should still succeed even if email fails
      expect(result).toHaveProperty('message');
      expect(result.userWithoutPassword).toBeDefined();
    });

    it('should throw InternalServerErrorException on database error', async () => {
      // Arrange
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prismaService.user.count as jest.Mock).mockResolvedValue(1);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed_password');
      (prismaService.user.create as jest.Mock).mockRejectedValue(
        new Error('Database error'),
      );

      // Act & Assert
      await expect(service.register(registerDto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('verifyEmail', () => {
    it('should verify email successfully with valid token', async () => {
      // Arrange
      const token = 'valid-token-123';
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 24);

      (prismaService.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        isEmailVerified: false,
        emailVerificationTokenExpiry: futureDate,
      });
      (prismaService.user.update as jest.Mock).mockResolvedValue({
        id: 'user-123',
        isEmailVerified: true,
        emailVerifiedAt: new Date(),
      });

      // Act
      const result = await service.verifyEmail(token);

      // Assert
      expect(result.message).toContain('Email verified successfully');
      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: {
          isEmailVerified: true,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          emailVerifiedAt: expect.any(Date),
          emailVerificationToken: null,
          emailVerificationTokenExpiry: null,
        },
      });
    });

    it('should throw BadRequestException for invalid token', async () => {
      // Arrange
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(service.verifyEmail('invalid-token')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.verifyEmail('invalid-token')).rejects.toThrow(
        'Invalid or expired verification token',
      );
    });

    it('should throw BadRequestException if email already verified', async () => {
      // Arrange
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        isEmailVerified: true,
      });

      // Act & Assert
      await expect(service.verifyEmail('some-token')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.verifyEmail('some-token')).rejects.toThrow(
        'Email already verified',
      );
    });

    it('should throw BadRequestException if token is expired', async () => {
      // Arrange
      const pastDate = new Date();
      pastDate.setHours(pastDate.getHours() - 1); // Expired 1 hour ago

      (prismaService.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        isEmailVerified: false,
        emailVerificationTokenExpiry: pastDate,
      });

      // Act & Assert
      await expect(service.verifyEmail('expired-token')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.verifyEmail('expired-token')).rejects.toThrow(
        'Verification token has expired',
      );
    });
  });

  describe('resendVerificationEmail', () => {
    it('should resend verification email successfully', async () => {
      // Arrange
      const email = 'test@example.com';
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-123',
        email,
        firstName: 'John',
        isEmailVerified: false,
      });
      (prismaService.user.update as jest.Mock).mockResolvedValue({
        id: 'user-123',
        emailVerificationToken: 'new-token',
      });
      (mailService.sendVerificationEmail as jest.Mock).mockResolvedValue(
        undefined,
      );

      // Act
      const result = await service.resendVerificationEmail(email);

      // Assert
      expect(result.message).toContain('Verification email sent');
      expect(prismaService.user.update).toHaveBeenCalled();
      expect(mailService.sendVerificationEmail).toHaveBeenCalled();
    });

    it('should throw BadRequestException if user not found', async () => {
      // Arrange
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.resendVerificationEmail('nonexistent@example.com'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.resendVerificationEmail('nonexistent@example.com'),
      ).rejects.toThrow('User not found');
    });

    it('should throw BadRequestException if email already verified', async () => {
      // Arrange
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        isEmailVerified: true,
      });

      // Act & Assert
      await expect(
        service.resendVerificationEmail('test@example.com'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.resendVerificationEmail('test@example.com'),
      ).rejects.toThrow('Email already verified');
    });
  });

  describe('requestPasswordReset', () => {
    it('should send password reset email for existing user', async () => {
      // Arrange
      const email = 'test@example.com';
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-123',
        email,
        firstName: 'John',
      });
      (prismaService.user.update as jest.Mock).mockResolvedValue({
        id: 'user-123',
        passwordResetToken: 'reset-token',
      });
      (mailService.sendPasswordResetEmail as jest.Mock).mockResolvedValue(
        undefined,
      );

      // Act
      const result = await service.requestPasswordReset(email);

      // Assert
      expect(result.message).toContain('password reset link has been sent');
      expect(prismaService.user.update).toHaveBeenCalled();
      expect(mailService.sendPasswordResetEmail).toHaveBeenCalled();
    });

    it('should return generic message for non-existent user (security)', async () => {
      // Arrange
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(null);

      // Act
      const result = await service.requestPasswordReset(
        'nonexistent@example.com',
      );

      // Assert - Should not reveal if user exists
      expect(result.message).toContain('password reset link has been sent');
      expect(prismaService.user.update).not.toHaveBeenCalled();
    });

    it('should handle email sending failure gracefully', async () => {
      // Arrange
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        firstName: 'John',
      });
      (prismaService.user.update as jest.Mock).mockResolvedValue({
        id: 'user-123',
      });
      (mailService.sendPasswordResetEmail as jest.Mock).mockRejectedValue(
        new Error('Email error'),
      );

      // Act
      const result = await service.requestPasswordReset('test@example.com');

      // Assert - Should still return success message
      expect(result.message).toContain('password reset link has been sent');
    });
  });

  describe('resetPassword', () => {
    it('should reset password successfully with valid token', async () => {
      // Arrange
      const token = 'valid-reset-token';
      const newPassword = 'NewP@ssw0rd!';
      const hashedPassword = 'new-hashed-password';
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 1);

      (prismaService.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        passwordResetExpires: futureDate,
      });
      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);
      (prismaService.user.update as jest.Mock).mockResolvedValue({
        id: 'user-123',
      });
      (prismaService.refreshToken.deleteMany as jest.Mock).mockResolvedValue({
        count: 2,
      });

      // Act
      const result = await service.resetPassword(token, newPassword);

      // Assert
      expect(result.message).toContain('Password reset successfully');
      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: {
          password: hashedPassword,
          passwordResetToken: null,
          passwordResetExpires: null,
        },
      });
      expect(prismaService.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
      });
    });

    it('should throw BadRequestException for invalid token', async () => {
      // Arrange
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.resetPassword('invalid-token', 'NewPassword123!'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.resetPassword('invalid-token', 'NewPassword123!'),
      ).rejects.toThrow('Invalid or expired reset token');
    });

    it('should throw BadRequestException if token is expired', async () => {
      // Arrange
      const pastDate = new Date();
      pastDate.setHours(pastDate.getHours() - 2);

      (prismaService.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-123',
        passwordResetExpires: pastDate,
      });

      // Act & Assert
      await expect(
        service.resetPassword('expired-token', 'NewPassword123!'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.resetPassword('expired-token', 'NewPassword123!'),
      ).rejects.toThrow('Reset token has expired');
    });
  });

  describe('login', () => {
    const loginDto = {
      email: 'test@example.com',
      password: 'Test@1234',
    };

    it('should login successfully with valid credentials', async () => {
      // Arrange
      const hashedPassword = 'hashed_password_123';
      const mockUser = {
        id: 'user-123',
        email: loginDto.email,
        password: hashedPassword,
        role: Role.CUSTOMER,
      };

      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (jwtService.sign as jest.Mock)
        .mockReturnValueOnce('access-token-123')
        .mockReturnValueOnce('refresh-token-123');
      (prismaService.refreshToken.create as jest.Mock).mockResolvedValue({
        id: 'refresh-123',
      });

      // Act
      const result = await service.login(loginDto);

      // Assert
      expect(result).toEqual({
        access_token: 'access-token-123',
        refresh_token: 'refresh-token-123',
      });
      expect(bcrypt.compare).toHaveBeenCalledWith(
        loginDto.password,
        hashedPassword,
      );
      expect(prismaService.refreshToken.create).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException for non-existent user', async () => {
      // Arrange
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.login(loginDto)).rejects.toThrow(
        'Invalid credentials',
      );
    });

    it('should throw UnauthorizedException for invalid password', async () => {
      // Arrange
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-123',
        email: loginDto.email,
        password: 'hashed_password',
        role: Role.CUSTOMER,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      // Act & Assert
      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.login(loginDto)).rejects.toThrow(
        'Invalid credentials',
      );
    });
  });

  describe('logout', () => {
    it('should logout successfully with valid refresh token', async () => {
      // Arrange
      const refreshToken = 'valid-refresh-token';
      (prismaService.refreshToken.deleteMany as jest.Mock).mockResolvedValue({
        count: 1,
      });

      // Act
      const result = await service.logout(refreshToken);

      // Assert
      expect(result.message).toBe('Logged out successfully');
      expect(prismaService.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { token: refreshToken },
      });
    });

    it('should throw UnauthorizedException if token not found', async () => {
      // Arrange
      (prismaService.refreshToken.deleteMany as jest.Mock).mockResolvedValue({
        count: 0,
      });

      // Act & Assert
      await expect(service.logout('invalid-token')).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.logout('invalid-token')).rejects.toThrow(
        'Refresh token not found',
      );
    });
  });

  describe('logoutAll', () => {
    it('should logout from all devices successfully', async () => {
      // Arrange
      const userId = 'user-123';
      (prismaService.refreshToken.deleteMany as jest.Mock).mockResolvedValue({
        count: 3,
      });

      // Act
      const result = await service.logoutAll(userId);

      // Assert
      expect(result.message).toBe('Logged out from all devices successfully');
      expect(prismaService.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { userId },
      });
    });
  });

  describe('refreshTokens', () => {
    it('should refresh tokens successfully with valid refresh token', async () => {
      // Arrange
      const refreshToken = 'valid-refresh-token';
      const payload = {
        sub: 'user-123',
        email: 'test@example.com',
        role: Role.CUSTOMER,
      };
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      (jwtService.verify as jest.Mock).mockReturnValue(payload);
      (prismaService.refreshToken.findFirst as jest.Mock).mockResolvedValue({
        id: 'refresh-id-123',
        token: refreshToken,
        userId: payload.sub,
        expiresAt: futureDate,
        user: {
          id: payload.sub,
          email: payload.email,
          role: payload.role,
        },
      });
      (jwtService.sign as jest.Mock)
        .mockReturnValueOnce('new-access-token')
        .mockReturnValueOnce('new-refresh-token');
      (prismaService.refreshToken.delete as jest.Mock).mockResolvedValue({});
      (prismaService.refreshToken.create as jest.Mock).mockResolvedValue({});

      // Act
      const result = await service.refreshTokens(refreshToken);

      // Assert
      expect(result).toEqual({
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
      });
      expect(prismaService.refreshToken.delete).toHaveBeenCalled();
      expect(prismaService.refreshToken.create).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException for invalid token', async () => {
      // Arrange
      (jwtService.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      // Act & Assert
      await expect(service.refreshTokens('invalid-token')).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.refreshTokens('invalid-token')).rejects.toThrow(
        'Invalid refresh token',
      );
    });

    it('should throw UnauthorizedException if token not found in database', async () => {
      // Arrange
      const payload = {
        sub: 'user-123',
        email: 'test@example.com',
        role: Role.CUSTOMER,
      };
      (jwtService.verify as jest.Mock).mockReturnValue(payload);
      (prismaService.refreshToken.findFirst as jest.Mock).mockResolvedValue(
        null,
      );

      // Act & Assert
      await expect(
        service.refreshTokens('valid-but-not-stored'),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.refreshTokens('valid-but-not-stored'),
      ).rejects.toThrow('Refresh token not found');
    });

    it('should throw UnauthorizedException if token is expired', async () => {
      // Arrange
      const payload = {
        sub: 'user-123',
        email: 'test@example.com',
        role: Role.CUSTOMER,
      };
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      (jwtService.verify as jest.Mock).mockReturnValue(payload);
      (prismaService.refreshToken.findFirst as jest.Mock).mockResolvedValue({
        id: 'refresh-id-123',
        token: 'expired-token',
        userId: payload.sub,
        expiresAt: pastDate,
        user: {
          id: payload.sub,
          email: payload.email,
          role: payload.role,
        },
      });
      (prismaService.refreshToken.delete as jest.Mock).mockResolvedValue({});

      // Act & Assert
      await expect(service.refreshTokens('expired-token')).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.refreshTokens('expired-token')).rejects.toThrow(
        'Refresh token expired',
      );
      expect(prismaService.refreshToken.delete).toHaveBeenCalled();
    });
  });

  describe('handleOAuthLogin', () => {
    const oAuthProfile = {
      provider: 'google' as const,
      providerId: 'google-123',
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
      avatar: 'https://example.com/avatar.jpg',
    };

    it('should login existing OAuth user successfully', async () => {
      // Arrange
      const existingUser = {
        id: 'user-123',
        email: oAuthProfile.email,
        firstName: oAuthProfile.firstName,
        lastName: oAuthProfile.lastName,
        provider: oAuthProfile.provider,
        providerId: oAuthProfile.providerId,
        avatar: oAuthProfile.avatar,
        role: Role.CUSTOMER,
        isEmailVerified: true,
      };

      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(
        existingUser,
      );
      (jwtService.sign as jest.Mock)
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token');

      // Act
      const result = await service.handleOAuthLogin(oAuthProfile);

      // Assert
      expect(result.message).toBe('Login successful');
      expect(result.user.id).toBe(existingUser.id);
      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
    });

    it('should create new OAuth user if not exists', async () => {
      // Arrange
      const newUser = {
        id: 'user-new-123',
        email: oAuthProfile.email,
        firstName: oAuthProfile.firstName,
        lastName: oAuthProfile.lastName,
        provider: oAuthProfile.provider,
        providerId: oAuthProfile.providerId,
        avatar: oAuthProfile.avatar,
        role: Role.CUSTOMER,
        isEmailVerified: true,
      };

      (prismaService.user.findUnique as jest.Mock)
        .mockResolvedValueOnce(null) // OAuth lookup
        .mockResolvedValueOnce(null); // Email lookup
      (prismaService.user.create as jest.Mock).mockResolvedValue(newUser);
      (jwtService.sign as jest.Mock)
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token');

      // Act
      const result = await service.handleOAuthLogin(oAuthProfile);

      // Assert
      expect(result.message).toBe('Login successful');
      expect(prismaService.user.create).toHaveBeenCalledWith({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: expect.objectContaining({
          email: oAuthProfile.email,
          firstName: oAuthProfile.firstName,
          lastName: oAuthProfile.lastName,
          provider: oAuthProfile.provider,
          providerId: oAuthProfile.providerId,
          isEmailVerified: true,
          password: null,
        }),
      });
    });

    it('should throw ConflictException if email exists with different provider', async () => {
      // Arrange
      (prismaService.user.findUnique as jest.Mock)
        .mockResolvedValueOnce(null) // OAuth lookup
        .mockResolvedValueOnce({
          // Email lookup
          id: 'user-123',
          email: oAuthProfile.email,
          provider: 'github',
        });
      (jwtService.sign as jest.Mock)
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token');

      // Act & Assert
      await expect(service.handleOAuthLogin(oAuthProfile)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw InternalServerErrorException on database error', async () => {
      // Arrange
      (prismaService.user.findUnique as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      (prismaService.user.create as jest.Mock).mockRejectedValue(
        new Error('Database error'),
      );

      // Act & Assert
      await expect(service.handleOAuthLogin(oAuthProfile)).rejects.toThrow(
        InternalServerErrorException,
      );
      await expect(service.handleOAuthLogin(oAuthProfile)).rejects.toThrow(
        'OAuth login failed',
      );
    });
  });
});
