/* eslint-disable @typescript-eslint/unbound-method */
import { Test } from '@nestjs/testing';
import { PaymentService } from './payment.service';
import { ConfigService } from '@nestjs/config';
import { InternalServerErrorException } from '@nestjs/common';
import axios from 'axios';
import * as crypto from 'crypto';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('PaymentService', () => {
  let service: PaymentService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        PaymentService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, string | number> = {
                PAYMOB_API_KEY: 'test-api-key',
                PAYMOB_INTEGRATION_ID: 12345,
                PAYMOB_IFRAME_ID: 67890,
                PAYMOB_HMAC_SECRET: 'test-hmac-secret',
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
    configService = module.get<ConfigService>(ConfigService);

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('createPayment', () => {
    const orderId = 'order-123';
    const amount = 150.0;
    const userEmail = 'test@example.com';
    const userName = 'John Doe';

    it('should create payment successfully and return payment URL', async () => {
      // Arrange - Mock all 3 Paymob API calls
      const authToken = 'auth-token-123';
      const paymobOrderId = 98765;
      const paymentKey = 'payment-key-123';

      // Step 1: Auth token
      mockedAxios.post.mockResolvedValueOnce({
        data: { token: authToken },
      });

      // Step 2: Register order
      mockedAxios.post.mockResolvedValueOnce({
        data: { id: paymobOrderId },
      });

      // Step 3: Payment key
      mockedAxios.post.mockResolvedValueOnce({
        data: { token: paymentKey },
      });

      // Act
      const result = await service.createPayment(
        orderId,
        amount,
        userEmail,
        userName,
      );

      // Assert
      expect(result).toBe(
        `https://accept.paymob.com/api/acceptance/iframes/67890?payment_token=${paymentKey}`,
      );

      // Verify all API calls were made
      expect(mockedAxios.post).toHaveBeenCalledTimes(3);

      // Verify auth call
      expect(mockedAxios.post).toHaveBeenNthCalledWith(
        1,
        'https://accept.paymob.com/api/auth/tokens',
        { api_key: 'test-api-key' },
      );

      // Verify order registration
      expect(mockedAxios.post).toHaveBeenNthCalledWith(
        2,
        'https://accept.paymob.com/api/ecommerce/orders',
        expect.objectContaining({
          auth_token: authToken,
          amount_cents: 15000, // 150.00 EGP * 100
          currency: 'EGP',
          merchant_order_id: orderId,
        }),
      );

      // Verify payment key request
      expect(mockedAxios.post).toHaveBeenNthCalledWith(
        3,
        'https://accept.paymob.com/api/acceptance/payment_keys',
        expect.objectContaining({
          auth_token: authToken,
          amount_cents: 15000,
          order_id: paymobOrderId,
          integration_id: 12345,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          billing_data: expect.objectContaining({
            email: userEmail,
            first_name: 'John',
            last_name: 'Doe',
          }),
        }),
      );
    });

    it('should handle names with multiple spaces correctly', async () => {
      // Arrange
      mockedAxios.post.mockResolvedValueOnce({
        data: { token: 'auth-token' },
      });
      mockedAxios.post.mockResolvedValueOnce({
        data: { id: 12345 },
      });
      mockedAxios.post.mockResolvedValueOnce({
        data: { token: 'payment-key' },
      });

      // Act
      await service.createPayment(
        orderId,
        amount,
        userEmail,
        'John Middle Doe',
      );

      // Assert - Check payment key call
      expect(mockedAxios.post).toHaveBeenNthCalledWith(
        3,
        'https://accept.paymob.com/api/acceptance/payment_keys',
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          billing_data: expect.objectContaining({
            first_name: 'John',
            last_name: 'Middle Doe',
          }),
        }),
      );
    });

    it('should convert amount to cents correctly', async () => {
      // Arrange
      mockedAxios.post.mockResolvedValueOnce({
        data: { token: 'auth-token' },
      });
      mockedAxios.post.mockResolvedValueOnce({
        data: { id: 12345 },
      });
      mockedAxios.post.mockResolvedValueOnce({
        data: { token: 'payment-key' },
      });

      // Act
      await service.createPayment(orderId, 99.99, userEmail, userName);

      // Assert - Check order registration
      expect(mockedAxios.post).toHaveBeenNthCalledWith(
        2,
        'https://accept.paymob.com/api/ecommerce/orders',
        expect.objectContaining({
          amount_cents: 9999, // 99.99 * 100, rounded
        }),
      );
    });

    it('should throw InternalServerErrorException when auth fails', async () => {
      // Arrange
      mockedAxios.post.mockRejectedValueOnce(new Error('Network error'));

      // Act & Assert
      await expect(
        service.createPayment(orderId, amount, userEmail, userName),
      ).rejects.toThrow(InternalServerErrorException);
      await expect(
        service.createPayment(orderId, amount, userEmail, userName),
      ).rejects.toThrow('Failed to initialize payment');
    });

    it('should throw InternalServerErrorException when order registration fails', async () => {
      // Arrange
      mockedAxios.post.mockResolvedValueOnce({
        data: { token: 'auth-token' },
      });
      mockedAxios.post.mockRejectedValueOnce(new Error('Order error'));

      // Act & Assert
      await expect(
        service.createPayment(orderId, amount, userEmail, userName),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should throw InternalServerErrorException when payment key fails', async () => {
      // Arrange
      mockedAxios.post.mockResolvedValueOnce({
        data: { token: 'auth-token' },
      });
      mockedAxios.post.mockResolvedValueOnce({
        data: { id: 12345 },
      });
      mockedAxios.post.mockRejectedValueOnce(new Error('Payment key error'));

      // Act & Assert
      await expect(
        service.createPayment(orderId, amount, userEmail, userName),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should throw error if PAYMOB_API_KEY is not configured', async () => {
      // Arrange
      (configService.get as jest.Mock).mockReturnValueOnce(undefined);

      // Act & Assert
      await expect(
        service.createPayment(orderId, amount, userEmail, userName),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('verifyWebhookSignature', () => {
    it('should verify valid webhook signature', () => {
      // Arrange
      const webhookData = {
        amount_cents: 15000,
        created_at: '2024-12-20T10:30:00',
        currency: 'EGP',
        error_occured: false,
        has_parent_transaction: false,
        id: 123456,
        integration_id: 12345,
        is_3d_secure: true,
        is_auth: false,
        is_capture: false,
        is_refunded: false,
        is_standalone_payment: true,
        is_voided: false,
        order: {
          id: 98765,
        },
        owner: 999,
        pending: false,
        source_data_pan: '1234',
        source_data_sub_type: 'VISA',
        source_data_type: 'card',
        success: true,
        hmac: '',
      };

      // Create the concatenated string exactly as Paymob does
      const concatenated = `${webhookData.amount_cents}${webhookData.created_at}${webhookData.currency}${webhookData.error_occured}${webhookData.has_parent_transaction}${webhookData.id}${webhookData.integration_id}${webhookData.is_3d_secure}${webhookData.is_auth}${webhookData.is_capture}${webhookData.is_refunded}${webhookData.is_standalone_payment}${webhookData.is_voided}${webhookData.order.id}${webhookData.owner}${webhookData.pending}${webhookData.source_data_pan}${webhookData.source_data_sub_type}${webhookData.source_data_type}${webhookData.success}`;

      // Generate valid HMAC
      const validHmac = crypto
        .createHmac('sha512', 'test-hmac-secret')
        .update(concatenated)
        .digest('hex');

      webhookData.hmac = validHmac;

      // Act
      const result = service.verifyWebhookSignature(webhookData);

      // Assert
      expect(result).toBe(true);
    });

    it('should reject invalid webhook signature', () => {
      // Arrange
      const webhookData = {
        amount_cents: 15000,
        created_at: '2024-12-20T10:30:00',
        currency: 'EGP',
        error_occured: false,
        has_parent_transaction: false,
        id: 123456,
        integration_id: 12345,
        is_3d_secure: true,
        is_auth: false,
        is_capture: false,
        is_refunded: false,
        is_standalone_payment: true,
        is_voided: false,
        order: {
          id: 98765,
        },
        owner: 999,
        pending: false,
        source_data_pan: '1234',
        source_data_sub_type: 'VISA',
        source_data_type: 'card',
        success: true,
        hmac: 'invalid-hmac-signature',
      };

      // Act
      const result = service.verifyWebhookSignature(webhookData);

      // Assert
      expect(result).toBe(false);
    });

    it('should reject tampered webhook data', () => {
      // Arrange
      const webhookData = {
        amount_cents: 15000,
        created_at: '2024-12-20T10:30:00',
        currency: 'EGP',
        error_occured: false,
        has_parent_transaction: false,
        id: 123456,
        integration_id: 12345,
        is_3d_secure: true,
        is_auth: false,
        is_capture: false,
        is_refunded: false,
        is_standalone_payment: true,
        is_voided: false,
        order: {
          id: 98765,
        },
        owner: 999,
        pending: false,
        source_data_pan: '1234',
        source_data_sub_type: 'VISA',
        source_data_type: 'card',
        success: true,
        hmac: '',
      };

      // Generate valid HMAC for original amount
      const concatenated = `${webhookData.amount_cents}${webhookData.created_at}${webhookData.currency}${webhookData.error_occured}${webhookData.has_parent_transaction}${webhookData.id}${webhookData.integration_id}${webhookData.is_3d_secure}${webhookData.is_auth}${webhookData.is_capture}${webhookData.is_refunded}${webhookData.is_standalone_payment}${webhookData.is_voided}${webhookData.order.id}${webhookData.owner}${webhookData.pending}${webhookData.source_data_pan}${webhookData.source_data_sub_type}${webhookData.source_data_type}${webhookData.success}`;

      webhookData.hmac = crypto
        .createHmac('sha512', 'test-hmac-secret')
        .update(concatenated)
        .digest('hex');

      // Tamper with the amount after HMAC generation
      webhookData.amount_cents = 20000; // Changed from 15000

      // Act
      const result = service.verifyWebhookSignature(webhookData);

      // Assert
      expect(result).toBe(false);
    });

    it('should return false on verification error', () => {
      // Arrange - Pass incomplete/invalid data to cause an error
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const invalidData = {} as any;

      // Act
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      const result = service.verifyWebhookSignature(invalidData);

      // Assert
      expect(result).toBe(false);
    });

    it('should return false when HMAC_SECRET is not configured', () => {
      // Arrange
      (configService.get as jest.Mock).mockReturnValueOnce(undefined);

      const webhookData = {
        amount_cents: 15000,
        created_at: '2024-12-20T10:30:00',
        currency: 'EGP',
        error_occured: false,
        has_parent_transaction: false,
        id: 123456,
        integration_id: 12345,
        is_3d_secure: true,
        is_auth: false,
        is_capture: false,
        is_refunded: false,
        is_standalone_payment: true,
        is_voided: false,
        order: {
          id: 98765,
        },
        owner: 999,
        pending: false,
        source_data_pan: '1234',
        source_data_sub_type: 'VISA',
        source_data_type: 'card',
        success: true,
        hmac: 'some-hmac',
      };

      // Act
      const result = service.verifyWebhookSignature(webhookData);

      // Assert - Service catches the error and returns false
      expect(result).toBe(false);
    });
  });
});
