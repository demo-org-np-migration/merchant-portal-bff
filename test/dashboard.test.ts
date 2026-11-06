import { beforeEach, describe, expect, it, vi } from 'vitest';
import fp from 'fastify-plugin';

process.env.KEYCLOAK_ISSUER = 'http://keycloak.test/realms/cauri-test';
process.env.KEYCLOAK_CLIENT_ID = 'merchant-portal-bff';
process.env.KEYCLOAK_CLIENT_SECRET = 'test-secret';
process.env.PAYMENTS_API_URL = 'http://payments-api.test';
process.env.ACCOUNTS_API_URL = 'http://accounts-api.test';

// La verificación real de JWT contra JWKS de Keycloak la cubre auth.integration.test.ts
// sin este mock. Acá simulamos createJwtAuth para poder elegir, por test, el usuario que
// "trae" el token (vía el header x-test-user en vez de un JWT real): así probamos tanto
// el flujo feliz como el 403 por rol sin armar tokens firmados. Igual que la lib real
// (commons@1.2.1), el hook va envuelto en fastify-plugin para escapar del scope propio
// del plugin de auth y alcanzar a dashboardRoutes/chargesRoutes como hermanos.
vi.mock('@cauri/commons', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@cauri/commons')>();
  return {
    ...actual,
    createJwtAuth: () => ({
      express: () => (_req: unknown, _res: unknown, next: () => void) => next(),
      fastify: () =>
        fp(async (instance: import('fastify').FastifyInstance) => {
          instance.addHook('onRequest', async (request) => {
            const raw = request.headers['x-test-user'];
            const parsed =
              typeof raw === 'string'
                ? JSON.parse(raw)
                : { sub: 'bruno-comercio', roles: ['merchant'], merchant_id: 'merchant-1' };
            (request as { user?: unknown }).user = parsed;
          });
        }),
      requireRole:
        (role: string) =>
        async (request: import('fastify').FastifyRequest, reply: import('fastify').FastifyReply) => {
          const user = (request as { user?: { roles: string[] } }).user;
          if (!user?.roles.includes(role)) {
            reply.code(403).send({ error: { code: 'forbidden', message: `missing role ${role}` } });
          }
        },
    }),
  };
});

vi.mock('../src/clients/payments', () => ({
  getMerchant: vi.fn(),
  listPaymentsByAccount: vi.fn(),
  createCharge: vi.fn(),
}));

vi.mock('../src/clients/accounts', () => ({
  getAccount: vi.fn(),
}));

// Import dinámico: config.ts lee process.env al cargarse, así que hay que importar
// src/ recién después de setear las env vars de arriba.
const { buildServer } = await import('../src/server');
const paymentsClient = await import('../src/clients/payments');
const accountsClient = await import('../src/clients/accounts');

function merchantUser(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({ sub: 'bruno-comercio', roles: ['merchant'], merchant_id: 'merchant-1', ...overrides });
}

describe('merchant-portal-bff', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /merchant/dashboard', () => {
    it('un token sin merchant_id recibe 403 antes de entrar a la ruta', async () => {
      const app = buildServer();

      const response = await app.inject({
        method: 'GET',
        url: '/merchant/dashboard',
        headers: { 'x-test-user': JSON.stringify({ sub: 'sin-comercio', roles: ['merchant'] }) },
      });

      expect(response.statusCode).toBe(403);
      expect(response.json()).toEqual({ error: { code: 'forbidden', message: 'token has no merchant_id claim' } });

      await app.close();
    });

    it('agrega merchant, cuenta y últimos cobros usando el merchant_id del token', async () => {
      const merchant = {
        id: 'merchant-1',
        name: 'Almacén Bruno',
        account_id: 'account-1',
        created_at: '2026-01-01T00:00:00Z',
      };
      const account = {
        id: 'account-1',
        customer_id: 'customer-1',
        currency: 'ARS',
        balance: '50000.00',
        status: 'active',
        customer: { email: 'bruno@cauri.io', full_name: 'Bruno Comercio' },
      };
      const payments = [
        {
          id: 'payment-1',
          from_account: 'aaaaaaaa-0000-4000-8000-000000000101',
          to_account: 'account-1',
          merchant_id: 'merchant-1',
          amount: '1250.50',
          currency: 'ARS',
          status: 'completed',
          fraud_score: null,
          created_at: '2026-09-01T00:00:00Z',
          updated_at: '2026-09-01T00:00:00Z',
        },
      ];

      vi.mocked(paymentsClient.getMerchant).mockResolvedValue(merchant);
      vi.mocked(accountsClient.getAccount).mockResolvedValue(account);
      vi.mocked(paymentsClient.listPaymentsByAccount).mockResolvedValue(payments);

      const app = buildServer();
      const response = await app.inject({
        method: 'GET',
        url: '/merchant/dashboard',
        headers: { authorization: 'Bearer irrelevant-in-test', 'x-test-user': merchantUser() },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ merchant, account, payments });
      expect(paymentsClient.getMerchant).toHaveBeenCalledWith('merchant-1');
      expect(accountsClient.getAccount).toHaveBeenCalledWith('account-1');
      expect(paymentsClient.listPaymentsByAccount).toHaveBeenCalledWith('account-1');

      await app.close();
    });

    it('devuelve 403 si el token no trae el rol merchant', async () => {
      const app = buildServer();

      const response = await app.inject({
        method: 'GET',
        url: '/merchant/dashboard',
        headers: {
          authorization: 'Bearer irrelevant-in-test',
          'x-test-user': merchantUser({ roles: ['customer'] }),
        },
      });

      expect(response.statusCode).toBe(403);
      expect(response.json()).toEqual({ error: { code: 'forbidden', message: 'missing role merchant' } });
      expect(paymentsClient.getMerchant).not.toHaveBeenCalled();

      await app.close();
    });
  });

  describe('POST /merchant/charges', () => {
    it('crea un cobro contra el merchant_id del token', async () => {
      const payment = {
        id: 'payment-2',
        from_account: 'aaaaaaaa-0000-4000-8000-000000000101',
        to_account: 'account-1',
        merchant_id: 'merchant-1',
        amount: '500.00',
        currency: 'ARS',
        status: 'completed',
        fraud_score: null,
        created_at: '2026-09-01T00:00:00Z',
        updated_at: '2026-09-01T00:00:00Z',
      };
      vi.mocked(paymentsClient.createCharge).mockResolvedValue(payment);

      const app = buildServer();
      const response = await app.inject({
        method: 'POST',
        url: '/merchant/charges',
        headers: { authorization: 'Bearer irrelevant-in-test', 'x-test-user': merchantUser() },
        payload: {
          from_account: 'aaaaaaaa-0000-4000-8000-000000000101',
          amount: '500.00',
          currency: 'ARS',
          reference: 'venta-mostrador-1',
        },
      });

      expect(response.statusCode).toBe(201);
      expect(response.json()).toEqual(payment);
      expect(paymentsClient.createCharge).toHaveBeenCalledWith('merchant-1', {
        from_account: 'aaaaaaaa-0000-4000-8000-000000000101',
        amount: '500.00',
        currency: 'ARS',
        reference: 'venta-mostrador-1',
      });

      await app.close();
    });

    it('devuelve 400 si falta un campo requerido', async () => {
      const app = buildServer();
      const response = await app.inject({
        method: 'POST',
        url: '/merchant/charges',
        headers: { authorization: 'Bearer irrelevant-in-test', 'x-test-user': merchantUser() },
        payload: { amount: '500.00' },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe('invalid_body');
      expect(paymentsClient.createCharge).not.toHaveBeenCalled();

      await app.close();
    });

    it('devuelve 403 si el token no trae el rol merchant', async () => {
      const app = buildServer();
      const response = await app.inject({
        method: 'POST',
        url: '/merchant/charges',
        headers: {
          authorization: 'Bearer irrelevant-in-test',
          'x-test-user': merchantUser({ roles: ['customer'] }),
        },
        payload: {
          from_account: 'aaaaaaaa-0000-4000-8000-000000000101',
          amount: '500.00',
          currency: 'ARS',
          reference: 'venta-mostrador-1',
        },
      });

      expect(response.statusCode).toBe(403);
      expect(paymentsClient.createCharge).not.toHaveBeenCalled();

      await app.close();
    });
  });
});
