const test = require('node:test');
const assert = require('node:assert/strict');
const { createRateLimiter } = require('../middlewares/rateLimitMiddleware');

function run(limiter, ip = '127.0.0.1') {
  const headers = {};
  const response = {
    statusCode: 200,
    setHeader: (key, value) => { headers[key] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
  let calledNext = false;
  limiter({ ip }, response, () => { calledNext = true; });
  return { response, headers, calledNext };
}

test('rate limiter rejects requests above the configured limit', () => {
  const limiter = createRateLimiter({ windowMs: 60_000, max: 2 });
  assert.equal(run(limiter).calledNext, true);
  assert.equal(run(limiter).calledNext, true);
  const rejected = run(limiter);
  assert.equal(rejected.calledNext, false);
  assert.equal(rejected.response.statusCode, 429);
  assert.equal(rejected.response.body.error, 'Too many requests. Please try again later.');
  assert.ok(rejected.headers['Retry-After']);
});
