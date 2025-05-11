import { RecaptchaVerificationFailedError, RecaptchaVerificationInvalidError } from '../errors';

export class RecaptchaHttpClient {
  constructor(private readonly secretKey: string) {}

  async verify(recaptchaResponse: string): Promise<boolean> {
    const url = 'https://www.google.com/recaptcha/api/siteverify';
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        secret: this.secretKey,
        response: recaptchaResponse,
      }),
    });

    const data = <VerificationResponse>await response.json();

    if (!response.ok) throw new RecaptchaVerificationInvalidError(response);
    if (!data.success) throw new RecaptchaVerificationFailedError(response);

    return true;
  }
}

interface VerificationResponse {
  success: boolean;
  challenge_ts: string;
  hostname: string;
  score: number;
  action: string;
  'error-codes'?: string[];
}
