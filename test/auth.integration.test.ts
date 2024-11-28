import { describe, expect, it } from 'vitest';

// A diferencia de dashboard.test.ts, ACÁ NO mockeamos createJwtAuth: este test existe
// justo para probar que el hook de auth real de @cauri/commons protege /merchant/*. El
// issuer apunta a un puerto que no escucha nada: sin header Authorization, la lib
// rechaza antes de intentar resolver el JWKS, así que nunca llega a pegarle a esa URL.
process.env.KEYCLOAK_ISSUER = 'http://127.0.0.1:1/realms/x';
process.env.KEYCLOAK_CLIENT_ID = 'merchant-portal-bff';
process.env.KEYCLOAK_CLIENT_SECRET = 'test-secret';
process.env.PAYMENTS_API_URL = 'http://127.0.0.1:1';
process.env.ACCOUNTS_API_URL = 'http://127.0.0.1:1';

const { buildServer } = await import('../src/server');

describe('auth real de @cauri/commons sobre /merchant/dashboard', () => {
  it('GET /merchant/dashboard sin Authorization devuelve 401 con el envelope de error', async () => {
    const app = buildServer();

    const response = await app.inject({ method: 'GET', url: '/merchant/dashboard' });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: { code: 'unauthorized', message: 'missing bearer token' } });

    await app.close();
  });

  it('POST /merchant/charges sin Authorization devuelve 401 y no ejecuta el flujo', async () => {
    const app = buildServer();

    const response = await app.inject({
      method: 'POST',
      url: '/merchant/charges',
      payload: { from_account: 'x', amount: '1.00', currency: 'ARS', reference: 'r' },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: { code: 'unauthorized', message: 'missing bearer token' } });

    await app.close();
  });

  it('/health y /metrics siguen públicos (no deben quedar atrapados por el hook de auth)', async () => {
    const app = buildServer();

    const health = await app.inject({ method: 'GET', url: '/health' });
    const metrics = await app.inject({ method: 'GET', url: '/metrics' });

    expect(health.statusCode).toBe(200);
    expect(health.json()).toEqual({ status: 'ok' });
    expect(metrics.statusCode).toBe(200);

    await app.close();
  });
});
