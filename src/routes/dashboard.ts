import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { logger } from '@cauri/commons';
import { config } from '../config';
import { auth, requireMerchant } from '../auth';
import { getMerchant, listPaymentsByAccount } from '../clients/payments';
import { getAccount } from '../clients/accounts';

const log = logger(config.serviceName, config.env);

function errorBody(code: string, message: string) {
  return { error: { code, message } };
}

// las convenciones internas de API "merchant-portal-bff": el `merchant_id` sale del claim `merchant_id`
// del token, nunca de un param de la URL (un comercio no puede pedir el dashboard de
// otro con solo cambiar un id en el path).
const dashboardRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get(
    '/merchant/dashboard',
    { preHandler: [auth.requireRole('merchant'), requireMerchant] },
    async (request, reply) => {
      const merchantId = request.user?.merchant_id;
      if (!merchantId) {
        return reply.code(400).send(errorBody('missing_merchant_id', 'token has no merchant_id claim'));
      }

      const merchant = await getMerchant(merchantId);
      const [account, payments] = await Promise.all([
        getAccount(merchant.account_id),
        listPaymentsByAccount(merchant.account_id),
      ]);

      log.info({ merchant_id: merchantId }, 'dashboard served');

      return { merchant, account, payments };
    },
  );
};

export default dashboardRoutes;
