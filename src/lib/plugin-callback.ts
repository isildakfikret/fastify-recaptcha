import { FastifyPluginCallback } from 'fastify';
import { defaultOptions, RecaptchaPluginOptions } from '../contracts/plugin-options';
import { RecaptchaHeaderNotFoundError, RecaptchaPluginError } from '../errors';
import { RecaptchaHttpClient } from './recaptcha-http-client';

const pluginId = Symbol('fastify-recaptcha');
const maxTrackedClients = 10_000;

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

    const opts = { ...defaultOptions, ...options } as Required<RecaptchaPluginOptions<{ error: string }>>;
    const rateLimit = { max: 100, timeWindow: 60_000, ...opts.rateLimit };
    if (
      !Number.isSafeInteger(rateLimit.max) ||
      rateLimit.max < 1 ||
      !Number.isSafeInteger(rateLimit.timeWindow) ||
      rateLimit.timeWindow < 1
    ) {
      return done(new Error('Recaptcha rate limit must use positive integer values'));
    }

    fastify.decorate(pluginId, {
      getter() {
        return true;
      },
    });
    const recaptchaClient = new RecaptchaHttpClient(opts.secretKey);
    const requestCounts = new Map<string, { count: number; resetAt: number }>();
    let nextCleanupAt = 0;

    fastify.addHook('onRequest', async (req, res) => {
      try {
        const routeConfig = req.routeOptions.config;

        if (Object.hasOwn(routeConfig, 'recaptcha') && !routeConfig.recaptcha) return;

        const recaptchaResponse = req.headers['x-recaptcha-response'] as string;

        if (!recaptchaResponse) {
          const err = opts.err(new RecaptchaHeaderNotFoundError());
          return res.status(400).send(err);
        }

        const now = Date.now();
        let clientCount = requestCounts.get(req.ip);
        if (!clientCount || now >= clientCount.resetAt) {
          if (requestCounts.size >= maxTrackedClients && now >= nextCleanupAt) {
            for (const [ip, entry] of requestCounts) {
              if (now >= entry.resetAt) requestCounts.delete(ip);
            }
            nextCleanupAt = now + rateLimit.timeWindow;
          }

          if (!clientCount && requestCounts.size >= maxTrackedClients) {
            throw new RecaptchaPluginError('Rate limit exceeded', 429);
          }

          clientCount = { count: 0, resetAt: now + rateLimit.timeWindow };
          requestCounts.set(req.ip, clientCount);
        }

        if (clientCount.count >= rateLimit.max) {
          throw new RecaptchaPluginError('Rate limit exceeded', 429);
        }
        clientCount.count += 1;

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
