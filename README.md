# Fastify Recaptcha

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![NPM Version](https://img.shields.io/npm/v/fastify-recaptcha.svg)](https://www.npmjs.com/package/fastify-recaptcha)
[![Build Status](https://github.com/isildakfikret/fastify-recaptcha/actions/workflows/ci.yml/badge.svg)](https://github.com/isildakfikret/fastify-recaptcha/actions)
[![Downloads](https://img.shields.io/npm/dm/fastify-recaptcha.svg)](https://www.npmjs.com/package/fastify-recaptcha)
[![Sponsor](https://img.shields.io/badge/sponsor-GitHub%20Sponsors-critical)](https://github.com/sponsors/isildakfikret)

A [Fastify](https://fastify.dev) plugin that verifies Google reCAPTCHA (v2 and v3) tokens on incoming requests. Register it once and every route is protected. Routes that should stay public can opt out individually.

- Verifies the token with Google's `siteverify` API in an `onRequest` hook, so your handler never runs for a failed check.
- Works with both CommonJS and ES modules, and ships its own TypeScript types.
- Customizable error responses.
- No runtime dependencies other than `fastify-plugin`. HTTP calls use the built-in `fetch`.

## Table of contents

- [Requirements](#requirements)
- [Install](#install)
- [Quick start](#quick-start)
- [How it works](#how-it-works)
- [Sending the token from the client](#sending-the-token-from-the-client)
- [Options](#options)
- [Skipping verification for a route](#skipping-verification-for-a-route)
- [Customizing error responses](#customizing-error-responses)
- [Error reference](#error-reference)
- [TypeScript](#typescript)
- [Limitations](#limitations)
- [Testing your app](#testing-your-app)
- [Development](#development)
- [License](#license)

## Requirements

- Node.js `>= 20` (the plugin relies on the global `fetch`)
- Fastify `^5.3.2`
- A reCAPTCHA **secret key** from the [reCAPTCHA admin console](https://www.google.com/recaptcha/admin)

## Install

```bash
# npm
npm install fastify-recaptcha

# pnpm
pnpm add fastify-recaptcha

# yarn
yarn add fastify-recaptcha
```

## Quick start

```ts
import fastify from 'fastify';
import fastifyRecaptcha from 'fastify-recaptcha';

const app = fastify();

await app.register(fastifyRecaptcha, {
  secretKey: process.env.RECAPTCHA_SECRET_KEY!,
});

// Protected: the request must carry a valid `x-recaptcha-response` header.
app.post('/login', async () => ({ success: true }));

// Public: verification is skipped for this route.
app.get('/health', { config: { recaptcha: false } }, async () => 'ok');

await app.listen({ port: 3000 });
```

CommonJS works too:

```js
const app = require('fastify')();

app.register(require('fastify-recaptcha').default, {
  secretKey: process.env.RECAPTCHA_SECRET_KEY,
});
```

The package also exposes a named export, `import { fastifyRecaptcha } from 'fastify-recaptcha'`.

## How it works

The plugin adds a global `onRequest` hook. For each request it:

1. Skips the check if the route has `config: { recaptcha: false }`.
2. Reads the token from the **`x-recaptcha-response` request header**. If it is missing, it replies `400`.
3. Limits verification to 100 requests per client IP per minute by default. Excess requests receive `429`.
4. Sends the token and your secret key to `https://www.google.com/recaptcha/api/siteverify`.
5. Lets the request continue to your handler if Google reports `success: true`. Otherwise it replies with an error (see [Error reference](#error-reference)).

The plugin is wrapped with `fastify-plugin`, so the hook applies to the scope you register it in and its children. Register it on the root instance to protect everything, or inside an encapsulated plugin to protect only that part of your app.

> The hook runs on **every** HTTP method, including `GET`, unless a route opts out.

## Sending the token from the client

The token must be sent in the `x-recaptcha-response` **header**, not in the request body or query string.

```js
// reCAPTCHA v3
const token = await grecaptcha.execute('YOUR_SITE_KEY', { action: 'login' });

await fetch('/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-recaptcha-response': token,
  },
  body: JSON.stringify({ username, password }),
});
```

For reCAPTCHA v2, use the value returned by `grecaptcha.getResponse()` the same way.

If your frontend runs on another origin, make sure your CORS configuration allows the `x-recaptcha-response` header.

## Options

```ts
app.register(fastifyRecaptcha, {
  secretKey: 'your-secret-key',
  err: (error) => ({ error: error.message }),
  rateLimit: { max: 100, timeWindow: 60_000 },
});
```

| Option      | Type                                        | Required | Default                             | Description                                                                        |
| ----------- | ------------------------------------------- | -------- | ----------------------------------- | ---------------------------------------------------------------------------------- |
| `secretKey` | `string`                                    | yes      | -                                   | Your reCAPTCHA secret key. Registration fails if it is empty or blank.             |
| `err`       | `(err: Error \| RecaptchaPluginError) => T` | no       | `(err) => ({ error: err.message })` | Builds the response body that is sent when verification fails.                     |
| `rateLimit` | `{ max?: number; timeWindow?: number }`     | no       | `100` requests per `60_000` ms      | Limits verification attempts per client IP. Both values must be positive integers. |

`rateLimit.timeWindow` is in milliseconds. The client IP is taken from Fastify's `request.ip`; configure `trustProxy` appropriately when running behind a proxy. Rate-limited requests receive `429` and do not call Google's verification API.

Registering the plugin twice on the same instance throws `Recaptcha plugin is already registered`.

## Skipping verification for a route

Set `recaptcha: false` in the route config:

```ts
app.get('/public', { config: { recaptcha: false } }, async () => 'anyone can call this');
```

Any other value, or no `recaptcha` key at all, keeps verification on.

## Customizing error responses

The `err` function receives the error and returns the JSON body. The HTTP status code always comes from the error itself and cannot be changed through `err`.

```ts
app.register(fastifyRecaptcha, {
  secretKey: process.env.RECAPTCHA_SECRET_KEY!,
  err(error) {
    return {
      success: false,
      errors: [error.message],
    };
  },
});
```

Failed request example:

```http
HTTP/1.1 403 Forbidden
content-type: application/json; charset=utf-8

{"success":false,"errors":["The response provided is invalid or could not be verified."]}
```

## Error reference

All plugin errors extend `RecaptchaPluginError`, which carries a `status` property (the HTTP status code that is sent). They are available under the `errors` namespace.

| Error                               | Status          | When                                                          |
| ----------------------------------- | --------------- | ------------------------------------------------------------- |
| `RecaptchaHeaderNotFoundError`      | `400`           | The `x-recaptcha-response` header is missing or empty.        |
| `RecaptchaVerificationFailedError`  | `403`           | Google answered with `success: false` (bad or expired token). |
| `RecaptchaVerificationInvalidError` | Google's status | Google's API returned a non-2xx response.                     |

```ts
import { errors } from 'fastify-recaptcha';

app.register(fastifyRecaptcha, {
  secretKey: process.env.RECAPTCHA_SECRET_KEY!,
  err(error) {
    if (error instanceof errors.RecaptchaHeaderNotFoundError) {
      return { message: 'Please complete the captcha.' };
    }
    return { message: 'Captcha verification failed.' };
  },
});
```

Errors that are not `RecaptchaPluginError` instances, for example a network failure while calling Google, are not formatted by `err`. They are rethrown and handled by Fastify's normal error handling (usually a `500`).

## TypeScript

Types are included. The `recaptcha` route option is added to Fastify's `FastifyContextConfig`, so `config: { recaptcha: false }` is type-checked. The option types are exported as well:

```ts
import fastifyRecaptcha, { type RecaptchaPluginOptions, errors } from 'fastify-recaptcha';
```

## Limitations

- Only the `success` field of Google's response is checked. For reCAPTCHA v3, the **score** and **action** are not validated yet.
- The token is read from the `x-recaptcha-response` header only.
- The `siteverify` endpoint is fixed to `www.google.com`.

## Testing your app

Don't call Google from your test suite. Either skip verification on the routes under test, or use Google's public test keys. With these keys, verification always succeeds:

| Key        | Value                                      |
| ---------- | ------------------------------------------ |
| Site key   | `6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI` |
| Secret key | `6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe` |

A runnable server is available in [`example/demo-server.cjs`](example/demo-server.cjs). Run `pnpm build` first, then `node example/demo-server.cjs`.

```bash
curl -i -X POST http://127.0.0.1:3000/login                                   # 400, header missing
curl -i -X POST http://127.0.0.1:3000/login -H 'x-recaptcha-response: token'  # 200 with the test keys
curl -i http://127.0.0.1:3000/bypass                                          # 200, verification skipped
```

## Development

The project uses [pnpm](https://pnpm.io).

```bash
pnpm install

pnpm build        # CommonJS (dist/cjs), ESM (dist/esm) and types (dist/types)
pnpm test         # run the test suite once (vitest)
pnpm test:watch   # watch mode
pnpm test:cov     # tests with coverage
pnpm lint         # oxlint (type-aware)
pnpm format       # oxfmt
```

Tests start a real Fastify instance and mock the HTTP client, so they never reach Google.

Releases are managed with [Changesets](https://github.com/changesets/changesets). If your change affects users, run `pnpm changeset` and commit the generated file with your pull request.

## License

[MIT](LICENSE) © Fikret ISILDAK
