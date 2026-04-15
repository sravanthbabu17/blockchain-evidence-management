const selfsigned = require('selfsigned');
const attrs = [{ name: 'commonName', value: 'localhost' }];

(async () => {
  const pems = await selfsigned.generate(attrs, { days: 365 });
  console.log('Keys (async):', Object.keys(pems));
})();
