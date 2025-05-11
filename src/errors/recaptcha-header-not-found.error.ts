import { RecaptchaPluginError } from './recaptcha-plugin.error';

export class RecaptchaHeaderNotFoundError extends RecaptchaPluginError {
  constructor() {
    super('x-recaptcha-response header must be present in the request', 400);
  }
}
