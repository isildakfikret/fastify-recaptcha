import { FastifyPluginOptions } from 'fastify';
import { RecaptchaPluginError } from '../errors/recaptcha-plugin.error';

export interface RecaptchaPluginOptions<ERR_RESULT> extends FastifyPluginOptions {
  secretKey: string;
  err?: (err: Error | RecaptchaPluginError) => ERR_RESULT;
}

export const defaultOptions: RecaptchaPluginOptions<{ error: string }> = {
  secretKey: '',
  err(err: Error | RecaptchaPluginError) {
    return { error: err.message };
  },
};
