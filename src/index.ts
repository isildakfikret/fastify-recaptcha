import fp from 'fastify-plugin';
import { pluginCallback } from './lib/plugin-callback';

export * from './contracts/plugin-options';
export * as errors from './errors';

export const fastifyRecaptcha = fp(pluginCallback, {
  name: 'fastify-recaptcha',
});

export default fastifyRecaptcha;
