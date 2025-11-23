// Paymob API Response Types
export interface PaymobAuthResponse {
  token: string;
}

export interface PaymobOrderResponse {
  id: number;
}

export interface PaymobPaymentKeyResponse {
  token: string;
}

export interface PaymobBillingData {
  email: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  country: string;
  city: string;
  street: string;
  building: string;
  floor: string;
  apartment: string;
}

// Webhook payload structure
export interface PaymobWebhookData {
  obj: {
    id: number;
    amount_cents: number;
    success: boolean;
    is_auth: boolean;
    is_capture: boolean;
    is_standalone_payment: boolean;
    is_voided: boolean;
    is_refunded: boolean;
    is_3d_secure: boolean;
    integration_id: number;
    profile_id: number;
    has_parent_transaction: boolean;
    order: {
      id: number;
      created_at: string;
      delivery_needed: boolean;
      merchant: {
        id: number;
        created_at: string;
        phones: string[];
        company_emails: string[];
        company_name: string;
        state: string;
        country: string;
        city: string;
        postal_code: string;
        street: string;
      };
      collector: null;
      amount_cents: number;
      shipping_data: null;
      currency: string;
      is_payment_locked: boolean;
      is_return: boolean;
      is_cancel: boolean;
      is_returned: boolean;
      is_canceled: boolean;
      merchant_order_id: string;
      wallet_notification: null;
      paid_amount_cents: number;
      notify_user_with_email: boolean;
      items: any[];
      order_url: string;
      commission_fees: number;
      delivery_fees_cents: number;
      delivery_vat_cents: number;
      payment_method: string;
      merchant_staff_tag: null;
      api_source: string;
      data: Record<string, any>;
    };
    created_at: string;
    currency: string;
    source_data: {
      type: string;
      pan: string;
      sub_type: string;
    };
    api_source: string;
    terminal_id: null;
    merchant_commission: number;
    installment: null;
    discount_details: any[];
    is_void: boolean;
    is_refund: boolean;
    data: Record<string, any>;
    is_hidden: boolean;
    payment_key_claims: {
      user_id: number;
      amount_cents: number;
      currency: string;
      integration_id: number;
      billing_data: PaymobBillingData;
      lock_order_when_paid: boolean;
      extra: Record<string, any>;
    };
    error_occured: boolean;
    is_live: boolean;
    other_endpoint_reference: null;
    refunded_amount_cents: number;
    source_id: number;
    is_captured: boolean;
    captured_amount: number;
    merchant_staff_tag: null;
    updated_at: string;
    is_settled: boolean;
    bill_balanced: boolean;
    is_bill: boolean;
    owner: number;
    parent_transaction: null;
    pending: boolean;
    acq_response_code: string;
    pos_model: null;
    origin_id: null;
    transaction_processed_callback_responses: any[];
    cashout_amount_cents: null;
    voided_by: null;
  };
  type: 'TRANSACTION';
  hmac: string;
}

// Simplified webhook data for signature verification
export interface PaymobWebhookSignatureData {
  amount_cents: number;
  created_at: string;
  currency: string;
  error_occured: boolean;
  has_parent_transaction: boolean;
  id: number;
  integration_id: number;
  is_3d_secure: boolean;
  is_auth: boolean;
  is_capture: boolean;
  is_refunded: boolean;
  is_standalone_payment: boolean;
  is_voided: boolean;
  order: {
    id: number;
  };
  owner: number;
  pending: boolean;
  source_data_pan: string;
  source_data_sub_type: string;
  source_data_type: string;
  success: boolean;
  hmac: string;
}
