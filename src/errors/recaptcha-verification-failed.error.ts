import { RecaptchaPluginError } from './recaptcha-plugin.error';

export class RecaptchaVerificationFailedError extends RecaptchaPluginError {
  headers: object;
  body: unknown;

  constructor(res: Response) {
    super('The response provided is invalid or could not be verified.', 403);
    this.headers = Object.fromEntries(res.headers.entries());
    this.body = res.json();
  }
}
