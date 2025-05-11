const app = require('fastify')({ logger: true });

app.register(require('../dist/fastify-recaptcha.cjs').default, {
  // siteKey: '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI', // Google test site key
  secretKey: '6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe', // Google test secret key
});

app.post('/login', (req, res) => {
  res.send('ok');
});

app.get('/bypass', { config: { recaptcha: false } }, (req, res) => {
  res.send('ok');
});

app.listen({ port: 5000, host: '127.0.0.1' }, (err, _address) => {
  if (err) {
    app.log.error({ err }, 'Error starting server');
    process.exit(1);
  }
});
