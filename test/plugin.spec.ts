import fastify, { FastifyInstance } from 'fastify';
import * as supertest from 'supertest';
import { fastifyRecaptcha } from '../src';
import { RecaptchaHeaderNotFoundError, RecaptchaPluginError } from '../src/errors';
import { RecaptchaHttpClient } from '../src/lib/recaptcha-http-client';

jest.mock('../src/lib/recaptcha-http-client');

const generatePluginOptions = () => ({
  secretKey: '6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe', // Google test secret key
  err: (e: Error) => ({ error: e.message }),
});

describe('Fastify-Recaptcha Tests', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await fastify();
  });

  afterEach(async () => {
    await app.close();
  });

  it('should throw an error if the plugin is already registered', async () => {
    const options = generatePluginOptions();
    await app.register(fastifyRecaptcha, options);

    await expect(async () => {
      const options = generatePluginOptions();
      await app.register(fastifyRecaptcha, options);
    }).rejects.toThrow('Recaptcha plugin is already registered');
  });

  it('should throw an error if secretKey is missing', async () => {
    await expect(async () => {
      const options = generatePluginOptions();
      // @ts-ignore
      options.secretKey = undefined;
      await app.register(fastifyRecaptcha, options);
    }).rejects.toThrow('Recaptcha secret key is required');
  });

  it('should add the onRequest hook and validate recaptcha', async () => {
    const mockVerify = jest.fn().mockResolvedValue(true);
    (RecaptchaHttpClient as jest.Mock).mockImplementation(() => ({
      verify: mockVerify,
    }));

    const options = generatePluginOptions();
    app.register(fastifyRecaptcha, options);

    app.get('/test', { config: { recaptcha: true } }, async () => ({ success: true }));

    await app.ready();

    const response = await supertest(app.server).get('/test').set('x-recaptcha-response', 'valid-token');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true });
    expect(mockVerify).toHaveBeenCalledWith('valid-token');
  });

  it('should return 400 if x-recaptcha-response header is missing', async () => {
    const options = generatePluginOptions();
    await app.register(fastifyRecaptcha, options);

    app.get('/test', { config: { recaptcha: true } }, async () => ({ success: true }));

    await app.ready();

    const response = await supertest(app.server).get('/test');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: new RecaptchaHeaderNotFoundError().message });
  });

  it('should return custom error if recaptcha verification fails', async () => {
    const mockVerify = jest.fn().mockRejectedValue(new RecaptchaPluginError('Invalid token', 401));
    (RecaptchaHttpClient as jest.Mock).mockImplementation(() => ({
      verify: mockVerify,
    }));

    const options = generatePluginOptions();
    await app.register(fastifyRecaptcha, options);

    app.get('/test', { config: { recaptcha: true } }, async () => ({ success: true }));

    await app.ready();

    const response = await supertest(app.server).get('/test').set('x-recaptcha-response', 'invalid-token');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'Invalid token' });
  });

  it('should skip recaptcha validation if route config disables it', async () => {
    const options = generatePluginOptions();
    await app.register(fastifyRecaptcha, options);

    app.get('/test', { config: { recaptcha: false } }, async () => ({ success: true }));

    await app.ready();

    const response = await supertest(app.server).get('/test');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true });
  });
});
