import { AcuityAuth } from '../auth/AcuityAuth';
import { AppointmentDetails, AcuityPaymentDetails, PaymentResult } from '../types';
import axios from 'axios';

export class AcuityPaymentProcessor {
  private auth: AcuityAuth;

  constructor(auth: AcuityAuth) {
    this.auth = auth;
  }

  async processPayment(details: AcuityPaymentDetails): Promise<PaymentResult> {
    try {
      const token = await this.auth.getAccessToken();
      const appointment = await this.getAppointment(details.appointmentId, token);

      if (!appointment) {
        return {
          success: false,
          error: 'Appointment not found'
        };
      }

      if (appointment.paid) {
        return {
          success: false,
          error: 'Appointment is already paid'
        };
      }

      // Create payment intent
      const paymentIntent = await this.createPaymentIntent(details, token);
      if (!paymentIntent) {
        return {
          success: false,
          error: 'Failed to create payment intent'
        };
      }

      // Process payment through Nimipay
      const payment = await this.processNimipayPayment(paymentIntent.id, details);
      if (!payment) {
        return {
          success: false,
          error: 'Payment failed'
        };
      }

      // Update appointment status
      const updated = await this.updateAppointmentStatus(details.appointmentId, token, true);
      if (!updated) {
        return {
          success: false,
          error: 'Failed to update status'
        };
      }

      return {
        success: true,
        transactionId: payment.transactionId,
        amount: details.amount
      };
    } catch (error) {
      console.error('Payment processing failed:', error instanceof Error ? error.message : String(error));
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async refundPayment(appointmentId: number): Promise<PaymentResult> {
    try {
      const token = await this.auth.getAccessToken();
      const appointment = await this.getAppointment(appointmentId, token);

      if (!appointment) {
        return {
          success: false,
          error: 'Appointment not found'
        };
      }

      if (!appointment.paid) {
        return {
          success: false,
          error: 'Appointment is not paid'
        };
      }

      // Process refund through Nimipay
      const refund = await this.processNimipayRefund(appointmentId);
      if (!refund) {
        return {
          success: false,
          error: 'Refund failed'
        };
      }

      // Update appointment status
      const updated = await this.updateAppointmentStatus(appointmentId, token, false);
      if (!updated) {
        return {
          success: false,
          error: 'Failed to update status'
        };
      }

      return {
        success: true,
        transactionId: refund.transactionId,
        amount: appointment.price
      };
    } catch (error) {
      console.error('Refund processing failed:', error instanceof Error ? error.message : String(error));
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async getAppointmentDetails(appointmentId: number): Promise<AppointmentDetails | null> {
    try {
      const token = await this.auth.getAccessToken();
      const appointment = await this.getAppointment(appointmentId, token);
      if (!appointment) {
        return null;
      }
      return appointment;
    } catch (error) {
      console.error('Failed to get appointment details:', error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  async updateAppointmentPaymentStatus(appointmentId: number, paid: boolean): Promise<boolean> {
    try {
      const token = await this.auth.getAccessToken();
      const updated = await this.updateAppointmentStatus(appointmentId, token, paid);
      return !!updated;
    } catch (error) {
      console.error('Failed to update appointment payment status:', error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  private async getAppointment(appointmentId: number, token: string) {
    try {
      const response = await axios.get(
        `https://acuityscheduling.com/api/v1/appointments/${appointmentId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      return response.data;
    } catch (error) {
      return null;
    }
  }

  private async createPaymentIntent(details: AcuityPaymentDetails, token: string) {
    try {
      const response = await axios.post(
        'https://acuityscheduling.com/api/v1/payment-intents',
        {
          amount: details.amount,
          currency: details.currency,
          appointmentId: details.appointmentId,
          customerId: details.customerId
        },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      return response.data;
    } catch (error) {
      return null;
    }
  }

  private async processNimipayPayment(paymentIntentId: string, details: AcuityPaymentDetails) {
    try {
      const response = await axios.post('https://api.nimipay.com/v1/payments', {
        paymentIntentId,
        amount: details.amount,
        currency: details.currency
      });
      return response.data;
    } catch (error) {
      return null;
    }
  }

  private async processNimipayRefund(appointmentId: number) {
    try {
      const response = await axios.post('https://api.nimipay.com/v1/refunds', {
        appointmentId
      });
      return response.data;
    } catch (error) {
      return null;
    }
  }

  private async updateAppointmentStatus(appointmentId: number, token: string, paid: boolean) {
    try {
      const response = await axios.put(
        `https://acuityscheduling.com/api/v1/appointments/${appointmentId}`,
        {
          paid
        },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      return response.data;
    } catch (error) {
      return null;
    }
  }
}
