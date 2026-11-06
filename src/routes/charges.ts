import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { logger } from '@cauri/commons';
import { config } from '../config';
import { auth, requireMerchant } from '../auth';
import { createCharge } from '../clients/payments';

const log = logger(config.serviceName, config.env);

function errorBody(code: string, message: string) {
  return { error: { code, message } };
}

interface CreateChargeRequestBody {
  from_account?: string;
  amount?: string;
  currency?: string;
  reference?: string;
}

// El comercio cobra contra su propia cuenta: el `merchant_id` sale del token, igual que
// en el dashboard, así que no hace falta (ni se acepta) en el body.
const chargesRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.post<{ Body: CreateChargeRequestBody }>(
    '/merchant/charges',
    { preHandler: [auth.requireRole('merchant'), requireMerchant] },
    async (request, reply) => {
      const merchantId = request.user?.merchant_id;
      if (!merchantId) {
        return reply.code(400).send(errorBody('missing_merchant_id', 'token has no merchant_id claim'));
      }

      const {
        from_account: fromAccount,
        amount,
        currency,
        reference,
      } = request.body ?? {};

      if (!fromAccount || !amount || !currency || !reference) {
        return reply
          .code(400)
          .send(errorBody('invalid_body', 'from_account, amount, currency y reference son requeridos'));
      }

      const payment = await createCharge(merchantId, { from_account: fromAccount, amount, currency, reference });
      log.info({ merchant_id: merchantId, payment_id: payment.id }, 'charge created');

      return reply.code(201).send(payment);
    },
  );
};

export default chargesRoutes;
