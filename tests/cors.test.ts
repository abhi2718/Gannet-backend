import request from 'supertest';
import { createApp } from '../src/app';

/**
 * Verifies the global CORS policy: the configured origin (default
 * http://localhost:3000) is allowed with credentials, any other origin is not
 * reflected, and preflight (OPTIONS) requests are answered for the allowed origin.
 */
const app = createApp();
const ALLOWED = 'http://localhost:3000';
const DISALLOWED = 'http://evil.example.com';

describe('CORS policy', () => {
  it('reflects the allowed origin on a simple request', async () => {
    const res = await request(app)
      .get('/api/health')
      .set('Origin', ALLOWED);

    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe(ALLOWED);
  });

  it('allows credentials for the allowed origin', async () => {
    const res = await request(app)
      .get('/api/health')
      .set('Origin', ALLOWED);

    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('does not reflect a disallowed origin', async () => {
    const res = await request(app)
      .get('/api/health')
      .set('Origin', DISALLOWED);

    // Request still completes, but the browser-facing allow header is absent,
    // so the browser blocks the cross-origin read.
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('answers preflight (OPTIONS) for the allowed origin', async () => {
    const res = await request(app)
      .options('/api/orders')
      .set('Origin', ALLOWED)
      .set('Access-Control-Request-Method', 'POST');

    expect([200, 204]).toContain(res.status);
    expect(res.headers['access-control-allow-origin']).toBe(ALLOWED);
    expect(res.headers['access-control-allow-methods']).toBeDefined();
  });

  it('does not reflect the origin on a preflight from a disallowed origin', async () => {
    const res = await request(app)
      .options('/api/orders')
      .set('Origin', DISALLOWED)
      .set('Access-Control-Request-Method', 'POST');

    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
