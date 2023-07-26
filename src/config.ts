function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`missing required env var ${name}`);
  }
  return value;
}

export const config = {
  serviceName: process.env.SERVICE_NAME ?? 'merchant-portal-bff',
  env: process.env.ENV ?? 'staging',
  port: Number(process.env.PORT ?? 8080),
  logLevel: process.env.LOG_LEVEL ?? 'info',

  keycloakIssuer: required('KEYCLOAK_ISSUER'),
  keycloakClientId: process.env.KEYCLOAK_CLIENT_ID ?? 'merchant-portal-bff',
  keycloakClientSecret: process.env.KEYCLOAK_CLIENT_SECRET ?? '',

  paymentsApiUrl: required('PAYMENTS_API_URL'),
  accountsApiUrl: required('ACCOUNTS_API_URL'),
};
