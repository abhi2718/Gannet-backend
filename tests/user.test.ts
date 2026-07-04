import request from 'supertest';

// Mutable auth state so tests can act as an admin or a plain customer.
const mockAuthState: { user: { id: string; userType: string } } = {
  user: { id: '507f1f77bcf86cd799439011', userType: 'admin' },
};

jest.mock('../src/middlewares/auth', () => ({
  authenticate: (req: { user?: unknown }, _res: unknown, next: () => void) => {
    req.user = mockAuthState.user;
    next();
  },
  authorize:
    (...types: string[]) =>
    (
      req: { user?: { userType?: string } },
      res: { status: (c: number) => { json: (b: unknown) => void } },
      next: () => void
    ) => {
      if (!req.user || !types.includes(req.user.userType ?? '')) {
        return res.status(403).json({ success: false, message: 'Forbidden' });
      }
      next();
    },
}));

// Replace the Mongoose model with jest mocks, keeping the real enums.
jest.mock('../src/models/user.model', () => {
  const actual = jest.requireActual('../src/models/user.model');
  return {
    __esModule: true,
    ...actual,
    User: {
      aggregate: jest.fn(),
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

const app = createApp();
const mockUser = { id: 'u1', username: 'jane', email: 'jane@example.com' };
const VALID_ID = '507f1f77bcf86cd799439011';

beforeEach(() => {
  mockAuthState.user = { id: VALID_ID, userType: 'admin' };
});

describe('GET /api/users (admin list, aggregation)', () => {
  type Stage = Record<string, any>;
  const lastPipeline = (): Stage[] =>
    (User.aggregate as jest.Mock).mock.calls[0][0];
  const facetOf = (pipeline: Stage[]): Stage =>
    pipeline.find((s) => s.$facet)?.$facet;
  const searchOrOf = (pipeline: Stage[]): Stage[] | undefined =>
    pipeline.find((s) => s.$match && s.$match.$or)?.$match.$or;

  beforeEach(() => {
    (User.aggregate as jest.Mock).mockResolvedValue([
      { data: [], totalCount: [] },
    ]);
  });

  it('returns page 1 with a default page size of 20', async () => {
    (User.aggregate as jest.Mock).mockResolvedValue([
      { data: [mockUser, mockUser], totalCount: [{ count: 42 }] },
    ]);

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
    const facet = facetOf(lastPipeline());
    expect(facet.data).toContainEqual({ $skip: 0 });
    expect(facet.data).toContainEqual({ $limit: 20 });
  });

  it('honours page and limit query params', async () => {
    const res = await request(app).get('/api/users?page=2&limit=25');

    expect(res.status).toBe(200);
    const facet = facetOf(lastPipeline());
    expect(facet.data).toContainEqual({ $skip: 25 });
    expect(facet.data).toContainEqual({ $limit: 25 });
    expect(res.body.pagination.page).toBe(2);
  });

  it('rejects a page size below the minimum of 20', async () => {
    const res = await request(app).get('/api/users?limit=5');

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/limit/i);
    expect(User.aggregate).not.toHaveBeenCalled();
  });

  it('joins the order and address collections', async () => {
    await request(app).get('/api/users');
    const froms = lastPipeline()
      .filter((s) => s.$lookup)
      .map((s) => s.$lookup.from);
    expect(froms).toEqual(expect.arrayContaining(['orders', 'addresses']));
  });

  it('searches across name/email/phone/city', async () => {
    await request(app).get('/api/users?search=jane');
    const or = searchOrOf(lastPipeline()) ?? [];
    const fields = or.map((c) => Object.keys(c)[0]);
    expect(fields).toEqual(
      expect.arrayContaining(['username', 'email', 'phoneNumber', 'cities'])
    );
  });

  it('also matches an exact order count when the term is numeric', async () => {
    await request(app).get('/api/users?search=5');
    const or = searchOrOf(lastPipeline()) ?? [];
    expect(or).toContainEqual({ orderCount: 5 });
  });

  it('does not add an order-count clause for a non-numeric term', async () => {
    await request(app).get('/api/users?search=jane');
    const or = searchOrOf(lastPipeline()) ?? [];
    expect(or.some((c) => 'orderCount' in c)).toBe(false);
  });

  it('filters by status before the joins', async () => {
    await request(app).get('/api/users?status=inactive');
    expect(lastPipeline()[0].$match.status).toBe('inactive');
  });

  it('rejects an invalid status value', async () => {
    const res = await request(app).get('/api/users?status=banned');
    expect(res.status).toBe(400);
    expect(User.aggregate).not.toHaveBeenCalled();
  });

  it('never leaks the password hash (projected out)', async () => {
    await request(app).get('/api/users');
    const project = lastPipeline().find((s) => s.$project)?.$project;
    expect(project.password).toBe(0);
  });

  it('forbids a non-admin from listing users', async () => {
    mockAuthState.user = { id: 'u2', userType: 'customer' };
    const res = await request(app).get('/api/users');
    expect(res.status).toBe(403);
    expect(User.aggregate).not.toHaveBeenCalled();
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

  it('lets an admin deactivate a user via status', async () => {
    (User.findByIdAndUpdate as jest.Mock).mockResolvedValue({
      ...mockUser,
      status: 'inactive',
    });

    const res = await request(app)
      .patch(`/api/users/${VALID_ID}`)
      .send({ status: 'inactive' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('inactive');
  });

  it('rejects an invalid status on update', async () => {
    const res = await request(app)
      .patch(`/api/users/${VALID_ID}`)
      .send({ status: 'banned' });
    expect(res.status).toBe(400);
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
