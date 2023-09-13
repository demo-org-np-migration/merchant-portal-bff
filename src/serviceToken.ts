import { serviceTokenProvider } from '@cauri/commons';
import { config } from './config';

// Client credentials contra Keycloak con el client de servicio `merchant-portal-bff`
// (las convenciones internas de API), para las llamadas salientes a payments-api y accounts-api.
export const serviceToken = serviceTokenProvider({
  issuer: config.keycloakIssuer,
  clientId: config.keycloakClientId,
  clientSecret: config.keycloakClientSecret,
});
