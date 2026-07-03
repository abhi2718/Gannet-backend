import request from 'supertest';

// NOTE: this suite intentionally uses the REAL queryRateLimiter to prove that a
// single client cannot spam the public endpoint. Only the model is mocked.
jest.mock('../src/models/query.model', () => {
  const actual = jest.requireActual('../src/models/query.model');
  return {
    __esModule: true,
    ...actual,
    Query: { create: jest.fn() },
  };
});

import { createApp } from '../src/app';
import { Query } from '../src/models/query.model';

const app = createApp();
const validBody = {
  fullName: 'John Doe',
  mobileNumber: '+12025550123',
  email: 'john@example.com',
  city: 'Springfield',
  requirement: 'Bulk quote',
  message: 'Please send me a detailed bulk quote for 500 widgets.',
};

describe('POST /api/queries rate limiting', () => {
  it('allows up to 5 submissions then returns 429', async () => {
    (Query.create as jest.Mock).mockResolvedValue({ id: 'q1', ...validBody });

    const statuses: number[] = [];
    for (let i = 0; i < 6; i += 1) {
      const res = await request(app).post('/api/queries').send(validBody);
      statuses.push(res.status);
    }

    // First 5 succeed, the 6th is blocked by the limiter.
    expect(statuses.slice(0, 5)).toEqual([201, 201, 201, 201, 201]);
    expect(statuses[5]).toBe(429);
  });

  it('reports a helpful message when rate limited', async () => {
    // The limiter counter from the previous test is already exhausted.
    const res = await request(app).post('/api/queries').send(validBody);

    expect(res.status).toBe(429);
    expect(res.body.message).toMatch(/too many query submissions/i);
  });
});
