import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError } from 'axios';
import * as crypto from 'crypto';
import {
  PaymobAuthResponse,
  PaymobBillingData,
  PaymobOrderResponse,
  PaymobPaymentKeyResponse,
  PaymobWebhookSignatureData,
} from './interfaces/payment.interface';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private readonly baseUrl = 'https://accept.paymob.com/api';

  constructor(private readonly configService: ConfigService) {}

  /**
   * Step 1: Get authentication token from Paymob
   * Why: Paymob requires a short-lived token for subsequent API calls
   * This token expires after a short time for security
   */
  private async getAuthToken(): Promise<string> {
    try {
      const apiKey = this.configService.get<string>('PAYMOB_API_KEY');

      if (!apiKey) {
        throw new Error('PAYMOB_API_KEY is not configured');
      }

      const { data } = await axios.post<PaymobAuthResponse>(
        `${this.baseUrl}/auth/tokens`,
        { api_key: apiKey },
      );

      this.logger.log('Paymob auth token obtained');
      return data.token;
    } catch (error) {
      this.handlePaymobError(error, 'Failed to get Paymob auth token');
      throw new InternalServerErrorException('Failed to initialize payment');
    }
  }

  /**
   * Step 2: Register order with Paymob
   * Why: Paymob needs to know what's being purchased before payment
   * Returns Paymob's internal order ID (different from your order ID)
   */
  private async registerOrder(
    authToken: string,
    amountCents: number,
    orderId: string,
  ): Promise<number> {
    try {
      const { data } = await axios.post<PaymobOrderResponse>(
        `${this.baseUrl}/ecommerce/orders`,
        {
          auth_token: authToken,
          delivery_needed: 'false', // Digital product (no shipping)
          amount_cents: amountCents,
          currency: 'EGP',
          merchant_order_id: orderId, // Your order ID for reference
          items: [], // Can add order items here if needed for reporting
        },
      );

      this.logger.log(`Paymob order registered: ${data.id}`);
      return data.id; // Paymob's order ID
    } catch (error) {
      this.handlePaymobError(error, 'Failed to register order with Paymob');
      throw new InternalServerErrorException('Failed to register payment');
    }
  }

  /**
   * Step 3: Get payment key
   * Why: This key is used to generate the final payment URL
   * Each payment attempt gets a unique key (supports retries)
   */
  private async getPaymentKey(
    authToken: string,
    paymobOrderId: number,
    amountCents: number,
    billingData: PaymobBillingData,
  ): Promise<string> {
    try {
      const integrationId = this.configService.get<number>(
        'PAYMOB_INTEGRATION_ID',
      );

      if (!integrationId) {
        throw new Error('PAYMOB_INTEGRATION_ID is not configured');
      }

      const { data } = await axios.post<PaymobPaymentKeyResponse>(
        `${this.baseUrl}/acceptance/payment_keys`,
        {
          auth_token: authToken,
          amount_cents: amountCents,
          expiration: 3600, // Payment link expires in 1 hour
          order_id: paymobOrderId,
          billing_data: billingData,
          currency: 'EGP',
          integration_id: integrationId,
        },
      );

      this.logger.log('Paymob payment key generated');
      return data.token;
    } catch (error) {
      this.handlePaymobError(error, 'Failed to get payment key');
      throw new InternalServerErrorException('Failed to generate payment key');
    }
  }

  /**
   * Main method: Orchestrates all 3 steps and returns payment URL
   * This is what you call from your OrdersService
   */
  async createPayment(
    orderId: string,
    amount: number,
    userEmail: string,
    userName: string,
  ): Promise<string> {
    this.logger.log(`Creating payment for order: ${orderId}`);

    // Convert EGP to cents (Paymob uses cents to avoid floating point issues)
    const amountCents = Math.round(amount * 100);

    // Step 1: Get authentication token
    const authToken = await this.getAuthToken();

    // Step 2: Register order with Paymob
    const paymobOrderId = await this.registerOrder(
      authToken,
      amountCents,
      orderId,
    );

    // Step 3: Prepare billing data (required by Paymob)
    const billingData: PaymobBillingData = {
      email: userEmail,
      first_name: userName.split(' ')[0] || 'Customer',
      last_name: userName.split(' ').slice(1).join(' ') || '',
      phone_number: '+20000000000', // TODO: Add phone to User model
      country: 'EG',
      city: 'Cairo',
      street: 'NA',
      building: 'NA',
      floor: 'NA',
      apartment: 'NA',
    };

    // Step 4: Get payment key
    const paymentKey = await this.getPaymentKey(
      authToken,
      paymobOrderId,
      amountCents,
      billingData,
    );

    // Step 5: Build final payment URL
    const iframeId = this.configService.get<number>('PAYMOB_IFRAME_ID');

    if (!iframeId) {
      throw new Error('PAYMOB_IFRAME_ID is not configured');
    }

    const paymentUrl = `https://accept.paymob.com/api/acceptance/iframes/${iframeId}?payment_token=${paymentKey}`;

    this.logger.log(`Payment URL generated for order: ${orderId}`);
    return paymentUrl;
  }

  /**
   * Verify webhook HMAC signature
   * Why: Ensure the webhook actually came from Paymob, not a hacker
   * How: Recreate the signature and compare with received one
   */
  verifyWebhookSignature(data: PaymobWebhookSignatureData): boolean {
    try {
      const {
        amount_cents,
        created_at,
        currency,
        error_occured,
        has_parent_transaction,
        id,
        integration_id,
        is_3d_secure,
        is_auth,
        is_capture,
        is_refunded,
        is_standalone_payment,
        is_voided,
        order,
        owner,
        pending,
        source_data_pan,
        source_data_sub_type,
        source_data_type,
        success,
        hmac,
      } = data;

      // Paymob's exact concatenation order (DO NOT CHANGE)
      // This order is defined by Paymob and must match exactly
      const concatenated = `${amount_cents}${created_at}${currency}${error_occured}${has_parent_transaction}${id}${integration_id}${is_3d_secure}${is_auth}${is_capture}${is_refunded}${is_standalone_payment}${is_voided}${order.id}${owner}${pending}${source_data_pan}${source_data_sub_type}${source_data_type}${success}`;

      const hmacSecret = this.configService.get<string>('PAYMOB_HMAC_SECRET');

      if (!hmacSecret) {
        throw new Error('PAYMOB_HMAC_SECRET is not configured');
      }

      // Create HMAC using SHA-512
      const calculatedHmac = crypto
        .createHmac('sha512', hmacSecret)
        .update(concatenated)
        .digest('hex');

      const receivedHmac = hmac;

      // Compare signatures (constant-time comparison would be better in production)
      const isValid = calculatedHmac === receivedHmac;

      if (!isValid) {
        this.logger.warn('Invalid webhook signature detected');
      }

      return isValid;
    } catch (error) {
      this.logger.error('Error verifying webhook signature', error);
      return false;
    }
  }

  /**
   * Helper: Handle Paymob API errors with detailed logging
   */
  private handlePaymobError(error: unknown, message: string): void {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      this.logger.error(message, {
        status: axiosError.response?.status,
        data: axiosError.response?.data,
        message: axiosError.message,
      });
    } else {
      this.logger.error(message, error);
    }
  }
}
