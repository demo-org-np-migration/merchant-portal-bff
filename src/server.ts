import Fastify from 'fastify';
import { logger } from '@cauri/commons';
import { config } from './config';

const log = logger(config.serviceName, config.env);

export function buildServer() {
  const app = Fastify({ logger: false });

  app.get('/health', async () => ({ status: 'ok' }));

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
