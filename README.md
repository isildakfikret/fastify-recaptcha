# Fastify Recaptcha

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![NPM Version](https://img.shields.io/npm/v/fastify-recaptcha.svg)](https://www.npmjs.com/package/fastify-recaptcha)
[![Build Status](https://github.com/isildakfikret/fastify-recaptcha/actions/workflows/ci.yml/badge.svg)](https://github.com/isildakfikret/fastify-recaptcha/actions)
[![Downloads](https://img.shields.io/npm/dm/fastify-recaptcha.svg)](https://www.npmjs.com/package/fastify-recaptcha)
[![Sponsor](https://img.shields.io/badge/sponsor-GitHub%20Sponsors-critical)](https://github.com/sponsors/isildakfikret)

Fastify Recaptcha is a plugin for the Fastify framework that provides easy integration with Google's reCAPTCHA service. It helps protect your application from spam and abuse by verifying user interactions.

## Install

```bash
# Using npm
npm install fastify-recaptcha

# Using pnpm
pnpm add fastify-recaptcha

# Using yarn
yarn add fastify-recaptcha
```

## Example

```javascript
const app = require('fastify')()

app.register(require('fastify-recaptcha').default, {
  secretKey: 'your-secret-key',
  err(err) {
    return {
      success: false,
      errors: [err.message],
    }
  },
})

app.post('/login', (req, res) => {
  res.send({ success: true })
})

// To bypass the recaptcha check
app.get('/bypass', { config: { recaptcha: false } }, (req, res) => {
  res.send('ok')
})

app.listen({ port: 3000, host: '127.0.0.1' }, err => {
  if (err) {
    console.error(err)
    process.exit(1)
  }
  console.log('Server is running on http://127.0.0.1:3000')
})
```
