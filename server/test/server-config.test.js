const test = require('node:test');
const assert = require('node:assert/strict');

const { resolveServerConfig } = require('../index');

test('resolveServerConfig uses Railway-friendly defaults', () => {
  const config = resolveServerConfig({ PORT: '4100', HOST: '0.0.0.0' });
  assert.deepEqual(config, { port: 4100, host: '0.0.0.0' });
});

test('resolveServerConfig falls back to local defaults', () => {
  const originalHost = process.env.HOST;
  const originalHostLower = process.env.host;
  try {
    delete process.env.HOST;
    delete process.env.host;
    const config = resolveServerConfig({});
    assert.deepEqual(config, { port: 3000, host: '0.0.0.0' });
  } finally {
    if (originalHost !== undefined) process.env.HOST = originalHost;
    if (originalHostLower !== undefined) process.env.host = originalHostLower;
  }
});
