import request from 'supertest';

// Bypass JWT/DB auth: the middleware just injects an admin user.
jest.mock('../src/middlewares/auth', () => ({
  authenticate: (req: { user?: unknown }, _res: unknown, next: () => void) => {
    req.user = { id: '507f1f77bcf86cd799439011', userType: 'admin' };
    next();
  },
  authorize: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

// Replace the Mongoose model with jest mocks, keeping the real UserType enum.
jest.mock('../src/models/user.model', () => {
  const actual = jest.requireActual('../src/models/user.model');
  return {
    __esModule: true,
    ...actual,
    User: {
      find: jest.fn(),
      countDocuments: jest.fn(),
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      findByIdAndDelete: jest.fn(),
    },
  };
});

import { createApp } from '../src/app';
import { User } from '../src/models/user.model';
import { makeQuery } from './helpers/mockQuery';

const app = createApp();
const mockUser = { id: 'u1', username: 'jane', email: 'jane@example.com' };
const VALID_ID = '507f1f77bcf86cd799439011';

describe('GET /api/users (pagination)', () => {
  it('returns page 1 with a default page size of 20', async () => {
    const query = makeQuery([mockUser, mockUser]);
    (User.find as jest.Mock).mockReturnValue(query);
    (User.countDocuments as jest.Mock).mockResolvedValue(42);

    const res = await request(app).get('/api/users');

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
    const query = makeQuery([mockUser]);
    (User.find as jest.Mock).mockReturnValue(query);
    (User.countDocuments as jest.Mock).mockResolvedValue(100);

    const res = await request(app).get('/api/users?page=2&limit=25');

    expect(res.status).toBe(200);
    expect(query.skip).toHaveBeenCalledWith(25);
    expect(query.limit).toHaveBeenCalledWith(25);
    expect(res.body.pagination.page).toBe(2);
  });

  it('rejects a page size below the minimum of 20', async () => {
    const res = await request(app).get('/api/users?limit=5');

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/limit/i);
    expect(User.find).not.toHaveBeenCalled();
  });
});

describe('GET /api/users/:id', () => {
  it('returns a user when found', async () => {
    (User.findById as jest.Mock).mockResolvedValue(mockUser);

    const res = await request(app).get(`/api/users/${VALID_ID}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ email: 'jane@example.com' });
  });

  it('returns 404 when the user does not exist', async () => {
    (User.findById as jest.Mock).mockResolvedValue(null);

    const res = await request(app).get(`/api/users/${VALID_ID}`);

    expect(res.status).toBe(404);
  });

  it('returns 400 for a malformed id', async () => {
    const res = await request(app).get('/api/users/not-an-id');

    expect(res.status).toBe(400);
  });
});

describe('PATCH /api/users/:id', () => {
  it('updates a user', async () => {
    (User.findByIdAndUpdate as jest.Mock).mockResolvedValue({
      ...mockUser,
      username: 'janet',
    });

    const res = await request(app)
      .patch(`/api/users/${VALID_ID}`)
      .send({ username: 'janet' });

    expect(res.status).toBe(200);
    expect(res.body.data.username).toBe('janet');
  });

  it('returns 400 for an empty update body', async () => {
    const res = await request(app).patch(`/api/users/${VALID_ID}`).send({});

    expect(res.status).toBe(400);
  });

  it('returns 404 when updating a missing user', async () => {
    (User.findByIdAndUpdate as jest.Mock).mockResolvedValue(null);

    const res = await request(app)
      .patch(`/api/users/${VALID_ID}`)
      .send({ username: 'ghost' });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/users/:id', () => {
  it('deletes a user', async () => {
    (User.findByIdAndDelete as jest.Mock).mockResolvedValue(mockUser);

    const res = await request(app).delete(`/api/users/${VALID_ID}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 404 when deleting a missing user', async () => {
    (User.findByIdAndDelete as jest.Mock).mockResolvedValue(null);

    const res = await request(app).delete(`/api/users/${VALID_ID}`);

    expect(res.status).toBe(404);
  });
});
