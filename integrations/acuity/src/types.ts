export interface AcuityConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope: string[];
}

export interface WebhookConfig {
  secret: string;
  endpoint?: string;  // Made optional since url is used
  url?: string;       // Made optional since endpoint is used
  events: string[];
}

export interface AcuityAuthResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

export interface AcuityPaymentDetails {
  amount: number;
  currency: string;
  appointmentId: number;
  customerId: string;
  timestamp?: string;
}

export interface PaymentResult {
  success: boolean;
  error?: string;
  transactionId?: string;
  amount?: number;
  appointmentId?: number;
  currency?: string;
  timestamp?: string;
}

export interface AppointmentDetails {
  id: number;
  paid: boolean;
  price: number;
  currency: string;
  customerId: string;
  timestamp: string;
}

export interface PaymentIntent {
  id: string;
  amount: number;
  currency: string;
  status: string;
}

export interface PaymentResponse {
  transactionId: string;
  status: string;
  amount: number;
  currency: string;
}

export interface RefundResponse {
  transactionId: string;
  status: string;
  amount: number;
  currency: string;
}

export interface WebhookEventData {
  appointmentId: number;
  status: string;
  transactionId: string;
  amount?: number;
  currency?: string;
  timestamp?: string;
}

// Base webhook event interface with common properties
interface BaseWebhookEvent {
  type?: string;
  action?: string;
  appointmentId?: number;
  timestamp?: string;
  signature?: string;
}

// Modern webhook event format
export interface WebhookEvent extends BaseWebhookEvent {
  type: string;
  data: WebhookEventData;
  signature: string;
}

// Legacy webhook event format
export interface LegacyWebhookEvent extends BaseWebhookEvent {
  action: string;
  appointmentId: number;
  timestamp: string;
  payload: any;
  signature: string;
}

// Intermediate webhook event format (used during transition)
export interface TransitionalWebhookEvent extends BaseWebhookEvent {
  action: string;
  appointmentId: number;
  timestamp: string;
  payload: any;
}

// Union type for all webhook event formats
export type AcuityWebhookEvent = WebhookEvent | LegacyWebhookEvent | TransitionalWebhookEvent;

// Helper type for webhook handlers
export type WebhookHandler = (event: AcuityWebhookEvent) => Promise<void>;
