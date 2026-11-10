import { createJwtAuth } from '@cauri/commons';
import { config } from './config';

// Valida los JWT que llegan del client `merchant-portal` (rol `merchant`), emitidos
// por el realm de Keycloak de las convenciones internas de API. El claim `merchant_id` del token queda
// en `request.user.merchant_id` (AuthUser lo tipa como opcional porque la lib es la
// misma para todos los servicios; acá siempre esperamos que venga).
export const auth = createJwtAuth({ issuer: config.keycloakIssuer });

// Autorización: además del rol `merchant`, toda ruta de comercio exige el claim `merchant_id` en el token.
// Un token sin ese claim es un token mal emitido para este client: se rechaza con 403 antes de entrar a la
// ruta (antes cada ruta lo chequeaba por su cuenta y respondía 400).
export const requireMerchant = async (
  request: import('fastify').FastifyRequest,
  reply: import('fastify').FastifyReply,
) => {
  // Un claim vacío o en blanco tampoco identifica a un comercio: se rechaza igual que uno ausente.
  const merchantId = request.user?.merchant_id;
  if (!merchantId || !String(merchantId).trim()) {
    return reply.code(403).send({ error: { code: 'forbidden', message: 'token has no merchant_id claim' } });
  }
};
