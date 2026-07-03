import request from 'supertest';

// Bypass rate limiting for functional tests (its own suite covers the limiter).
jest.mock('../src/middlewares/rateLimiter', () => ({
  apiRateLimiter: (_q: unknown, _s: unknown, next: () => void) => next(),
  authRateLimiter: (_q: unknown, _s: unknown, next: () => void) => next(),
  queryRateLimiter: (_q: unknown, _s: unknown, next: () => void) => next(),
}));

// Bypass JWT/DB auth for the admin list route: inject an admin user.
jest.mock('../src/middlewares/auth', () => ({
  authenticate: (req: { user?: unknown }, _res: unknown, next: () => void) => {
    req.user = { id: '507f1f77bcf86cd799439011', userType: 'admin' };
    next();
  },
  authorize: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

jest.mock('../src/models/query.model', () => ({
  __esModule: true,
  Query: {
    create: jest.fn(),
    find: jest.fn(),
    countDocuments: jest.fn(),
  },
}));

import { createApp } from '../src/app';
import { Query } from '../src/models/query.model';
import { makeQuery } from './helpers/mockQuery';

const app = createApp();
const validBody = {
  fullName: 'John Doe',
  mobileNumber: '+12025550123',
  email: 'john@example.com',
  city: 'Springfield',
  requirement: 'Bulk quote',
  message: 'Please send me a detailed bulk quote for 500 widgets.',
};

describe('POST /api/queries (public submission)', () => {
  it('accepts a valid enquiry without any auth token', async () => {
    (Query.create as jest.Mock).mockResolvedValue({ id: 'q1', ...validBody });

    const res = await request(app).post('/api/queries').send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(Query.create).toHaveBeenCalledWith(
      expect.objectContaining(validBody)
    );
  });

  it.each([
    'fullName',
    'mobileNumber',
    'email',
    'city',
    'requirement',
    'message',
  ])(
    'rejects when the required field "%s" is missing',
    async (field) => {
      const body: Record<string, unknown> = { ...validBody };
      delete body[field];

      const res = await request(app).post('/api/queries').send(body);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain(field);
      expect(Query.create).not.toHaveBeenCalled();
    }
  );

  it('rejects an invalid email', async () => {
    const res = await request(app)
      .post('/api/queries')
      .send({ ...validBody, email: 'not-an-email' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/email/i);
  });

  it('rejects an invalid mobile number', async () => {
    const res = await request(app)
      .post('/api/queries')
      .send({ ...validBody, mobileNumber: 'abc' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/mobileNumber/i);
  });

  it('rejects a message longer than 2000 characters', async () => {
    const res = await request(app)
      .post('/api/queries')
      .send({ ...validBody, message: 'x'.repeat(2001) });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/message/i);
    expect(Query.create).not.toHaveBeenCalled();
  });

  it('strips unknown fields before persisting', async () => {
    (Query.create as jest.Mock).mockResolvedValue({ id: 'q1', ...validBody });

    const res = await request(app)
      .post('/api/queries')
      .send({ ...validBody, isAdmin: true, extra: 'x' });

    expect(res.status).toBe(201);
    const arg = (Query.create as jest.Mock).mock.calls[0][0];
    expect(arg).not.toHaveProperty('isAdmin');
    expect(arg).not.toHaveProperty('extra');
  });

  it('returns a clean 400 for a malformed JSON body', async () => {
    const res = await request(app)
      .post('/api/queries')
      .set('Content-Type', 'application/json')
      .send('{ "fullName": "John", }');

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Invalid JSON payload in request body');
  });
});

describe('GET /api/queries (admin, paginated)', () => {
  it('returns page 1 with a default page size of 20', async () => {
    const query = makeQuery([{ id: 'q1', ...validBody }]);
    (Query.find as jest.Mock).mockReturnValue(query);
    (Query.countDocuments as jest.Mock).mockResolvedValue(42);

    const res = await request(app).get('/api/queries');

    expect(res.status).toBe(200);
    expect(res.body.pagination).toMatchObject({
      total: 42,
      page: 1,
      limit: 20,
      totalPages: 3,
      hasNextPage: true,
      hasPrevPage: false,
    });
    expect(query.skip).toHaveBeenCalledWith(0);
    expect(query.limit).toHaveBeenCalledWith(20);
  });

  it('honours page and limit query params', async () => {
    const query = makeQuery([{ id: 'q1', ...validBody }]);
    (Query.find as jest.Mock).mockReturnValue(query);
    (Query.countDocuments as jest.Mock).mockResolvedValue(100);

    const res = await request(app).get('/api/queries?page=2&limit=25');

    expect(res.status).toBe(200);
    expect(query.skip).toHaveBeenCalledWith(25);
    expect(query.limit).toHaveBeenCalledWith(25);
    expect(res.body.pagination.page).toBe(2);
  });

  it('rejects a page size below the minimum of 20', async () => {
    const res = await request(app).get('/api/queries?limit=5');

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/limit/i);
    expect(Query.find).not.toHaveBeenCalled();
  });
});
