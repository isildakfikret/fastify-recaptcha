import { FastifyPluginCallback } from 'fastify';
import { defaultOptions, RecaptchaPluginOptions } from '../contracts/plugin-options';
import { RecaptchaHeaderNotFoundError, RecaptchaPluginError } from '../errors';
import { RecaptchaHttpClient } from './recaptcha-http-client';

const pluginId = Symbol('fastify-recaptcha');

declare module 'fastify' {
  interface FastifyInstance {
    [pluginId]: boolean;
  }
  interface FastifyContextConfig {
    recaptcha?: boolean;
  }
}

export const pluginCallback: FastifyPluginCallback<RecaptchaPluginOptions<{ error: string }>> = (fastify, options, done) => {
  try {
    if (fastify.hasDecorator(pluginId)) return done(new Error('Recaptcha plugin is already registered'));
    if (!options.secretKey?.trim()) return done(new Error('Recaptcha secret key is required'));

    const opts = { ...defaultOptions, ...options };
    fastify.decorate(pluginId, {
      getter() {
        return true;
      },
    });
    const recaptchaClient = new RecaptchaHttpClient(opts.secretKey);

    fastify.addHook('onRequest', async (req, res) => {
      try {
        const routeConfig = req.routeOptions.config;

        if (Object.hasOwn(routeConfig, 'recaptcha') && !routeConfig.recaptcha) return;

        const recaptchaResponse = req.headers['x-recaptcha-response'] as string;

        if (!recaptchaResponse) {
          const err = opts.err(new RecaptchaHeaderNotFoundError());
          return res.status(400).send(err);
        }

        await recaptchaClient.verify(recaptchaResponse);
      } catch (err) {
        if (err instanceof RecaptchaPluginError) {
          const error = opts.err(err);
          return res.status(err.status).send(error);
        }
        throw err;
      }
    });

    done();
  } catch (err) {
    done(<Error>err);
  }
};
