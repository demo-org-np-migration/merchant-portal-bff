import { httpClient } from '@cauri/commons';
import { config } from '../config';
import { serviceToken } from '../serviceToken';

// accounts-api hace el join contra `ledger` y devuelve el customer embebido
// (las convenciones internas de API, "accounts-api").
export interface Account {
  id: string;
  customer_id: string;
  currency: string;
  balance: string;
  status: string;
  customer: {
    email: string;
    full_name: string;
  };
}

const client = httpClient({
  baseUrl: config.accountsApiUrl,
  getToken: () => serviceToken.getToken(),
});

export function getAccount(accountId: string): Promise<Account> {
  return client.get<Account>(`/v1/accounts/${accountId}`);
}
