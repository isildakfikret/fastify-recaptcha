import { RecaptchaPluginError } from './recaptcha-plugin.error';

export class RecaptchaVerificationInvalidError extends RecaptchaPluginError {
  headers: object;
  body: unknown;

  constructor(res: Response) {
    super('The response provided is invalid.', res.status);
    this.headers = Object.fromEntries(res.headers.entries());
    this.body = res.json();
  }
}
