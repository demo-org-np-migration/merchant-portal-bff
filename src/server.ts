import Fastify from 'fastify';
import { logger } from '@cauri/commons';
import { config } from './config';
import { auth } from './auth';
import { registerMetrics } from './metrics';
import dashboardRoutes from './routes/dashboard';

const log = logger(config.serviceName, config.env);

export function buildServer() {
  const app = Fastify({ logger: false });

  app.get('/health', async () => ({ status: 'ok' }));
  registerMetrics(app);

  // @cauri/commons@1.2.1: el hook onRequest de auth.fastify() se registra en el scope
  // que lo llama (acá, "secured"), no en un hijo propio del plugin de auth, así que
  // alcanza a dashboardRoutes por ser su hermano dentro de "secured". Por la misma
  // razón NO lo registramos directo en `app`: el hook se colaría también a /health y
  // /metrics.
  app.register(async (secured) => {
    await secured.register(auth.fastify());
    await secured.register(dashboardRoutes);
  });

  app.setErrorHandler((error, _request, reply) => {
    log.error({ err: error }, 'unhandled error');
    const status = error.statusCode ?? 500;
    reply.code(status).send({
      error: { code: status === 500 ? 'internal_error' : 'bad_request', message: error.message },
    });
  });

  app.setNotFoundHandler((_request, reply) => {
    reply.code(404).send({ error: { code: 'not_found', message: 'route not found' } });
  });

  return app;
}

async function main() {
  const app = buildServer();
  try {
    await app.listen({ host: '0.0.0.0', port: config.port });
    log.info({ port: config.port }, 'merchant-portal-bff listening');
  } catch (err) {
    log.error({ err }, 'failed to start merchant-portal-bff');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
