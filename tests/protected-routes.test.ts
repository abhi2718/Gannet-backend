import request from 'supertest';
import { createApp } from '../src/app';

/**
 * Uses the REAL auth middleware (no mocks) to prove every protected endpoint
 * rejects requests that arrive without a valid Bearer token.
 */
const app = createApp();

describe('Protected routes require authentication', () => {
  const cases: Array<[string, string]> = [
    ['get', '/api/users'],
    ['get', '/api/users/507f1f77bcf86cd799439011'],
    ['patch', '/api/users/507f1f77bcf86cd799439011'],
    ['delete', '/api/users/507f1f77bcf86cd799439011'],
    ['get', '/api/products'],
    ['post', '/api/products'],
    ['get', '/api/products/507f1f77bcf86cd799439011'],
    ['patch', '/api/products/507f1f77bcf86cd799439011'],
    ['delete', '/api/products/507f1f77bcf86cd799439011'],
    // Public query submission (POST) is intentionally excluded; only the
    // admin-only list of queries requires auth.
    ['get', '/api/queries'],
    ['patch', '/api/queries/507f1f77bcf86cd799439011'],
    ['delete', '/api/queries/507f1f77bcf86cd799439011'],
    ['get', '/api/orders'],
    ['get', '/api/orders/my'],
    ['post', '/api/orders'],
    ['get', '/api/orders/507f1f77bcf86cd799439011'],
    ['patch', '/api/orders/507f1f77bcf86cd799439011'],
    ['delete', '/api/orders/507f1f77bcf86cd799439011'],
    ['patch', '/api/orders/507f1f77bcf86cd799439011/status'],
    ['get', '/api/auth/me'],
  ];

  it.each(cases)('%s %s -> 401 without a token', async (method, path) => {
    const res = await (request(app) as never as Record<string, CallableFunction>)[
      method
    ](path);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});
