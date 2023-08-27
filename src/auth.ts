import { createJwtAuth } from '@cauri/commons';
import { config } from './config';

// Valida los JWT que llegan del client `merchant-portal` (rol `merchant`), emitidos
// por el realm de Keycloak de las convenciones internas de API. El claim `merchant_id` del token queda
// en `request.user.merchant_id` (AuthUser lo tipa como opcional porque la lib es la
// misma para todos los servicios; acá siempre esperamos que venga).
export const auth = createJwtAuth({ issuer: config.keycloakIssuer });
