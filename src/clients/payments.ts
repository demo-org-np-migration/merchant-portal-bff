import { httpClient } from '@cauri/commons';
import { config } from '../config';
import { serviceToken } from '../serviceToken';

// Shapes de payments-api (las convenciones internas de API y #5). Solo tipamos los campos que este BFF
// usa; payments-api es dueño del resto.
export interface Merchant {
  id: string;
  name: string;
  account_id: string;
  created_at: string;
}

export interface Payment {
  id: string;
  from_account: string;
  to_account: string;
  merchant_id: string | null;
  amount: string;
  currency: string;
  status: string;
  fraud_score: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateChargeBody {
  from_account: string;
  amount: string;
  currency: string;
  reference: string;
}

const client = httpClient({
  baseUrl: config.paymentsApiUrl,
  getToken: () => serviceToken.getToken(),
});

export function getMerchant(merchantId: string): Promise<Merchant> {
  return client.get<Merchant>(`/v1/merchants/${merchantId}`);
}

export function listPaymentsByAccount(accountId: string): Promise<Payment[]> {
  return client.get<Payment[]>(`/v1/payments?account_id=${encodeURIComponent(accountId)}`);
}

export function createCharge(merchantId: string, body: CreateChargeBody): Promise<Payment> {
  return client.post<Payment>(`/v1/merchants/${merchantId}/charges`, body);
}
