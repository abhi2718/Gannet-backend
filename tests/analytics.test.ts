import request from 'supertest';

// Mutable auth state so tests can act as an admin or a plain customer.
const mockAuthState: { user: { id: string; userType: string } } = {
  user: { id: 'admin1', userType: 'admin' },
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

jest.mock('../src/models/order.model', () => {
  const actual = jest.requireActual('../src/models/order.model');
  return {
    __esModule: true,
    ...actual,
    Order: { aggregate: jest.fn(), countDocuments: jest.fn() },
  };
});

jest.mock('../src/models/user.model', () => {
  const actual = jest.requireActual('../src/models/user.model');
  return { __esModule: true, ...actual, User: { countDocuments: jest.fn() } };
});

jest.mock('../src/models/query.model', () => {
  const actual = jest.requireActual('../src/models/query.model');
  return { __esModule: true, ...actual, Query: { aggregate: jest.fn() } };
});

import { createApp } from '../src/app';
import { Order } from '../src/models/order.model';
import { Query } from '../src/models/query.model';
import { User } from '../src/models/user.model';

const app = createApp();

beforeEach(() => {
  mockAuthState.user = { id: 'admin1', userType: 'admin' };
});

describe('GET /api/analytics/my-orders', () => {
  const USER_ID = '507f1f77bcf86cd799439011';

  beforeEach(() => {
    mockAuthState.user = { id: USER_ID, userType: 'customer' };
  });

  it("returns the caller's own order stats and total spent", async () => {
    (Order.aggregate as jest.Mock).mockResolvedValue([
      {
        _id: null,
        totalOrders: 5,
        deliveredOrders: 2,
        pendingOrders: 1,
        outForDeliveryOrders: 1,
        totalSpent: 250,
      },
    ]);

    const res = await request(app).get('/api/analytics/my-orders');

    expect(res.status).toBe(200); // a customer (non-admin) can access this
    expect(res.body.data).toEqual({
      totalOrders: 5,
      deliveredOrders: 2,
      pendingOrders: 1,
      outForDeliveryOrders: 1,
      totalSpent: 250,
    });
  });

  it('scopes the aggregation to the caller and sums quantity × amount', async () => {
    (Order.aggregate as jest.Mock).mockResolvedValue([]);

    await request(app).get('/api/analytics/my-orders');

    const pipeline = (Order.aggregate as jest.Mock).mock.calls[0][0];
    expect(pipeline[0].$match.user.toString()).toBe(USER_ID);
    expect(pipeline[1].$group.totalSpent.$sum).toEqual({
      $multiply: ['$quantity', '$amount'],
    });
  });

  it('returns zeros when the user has no orders', async () => {
    (Order.aggregate as jest.Mock).mockResolvedValue([]);

    const res = await request(app).get('/api/analytics/my-orders');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      totalOrders: 0,
      deliveredOrders: 0,
      pendingOrders: 0,
      outForDeliveryOrders: 0,
      totalSpent: 0,
    });
  });
});

describe('GET /api/analytics/order-status', () => {
  it('returns the count for every status (missing ones as 0)', async () => {
    (Order.aggregate as jest.Mock).mockResolvedValue([
      { _id: 'delivered', count: 10 },
      { _id: 'pending', count: 5 },
      { _id: 'cancelled', count: 1 },
    ]);

    const res = await request(app).get('/api/analytics/order-status');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      pending: 5,
      confirmed: 0,
      'out for delivery': 0,
      delivered: 10,
      cancelled: 1,
    });
  });

  it('forbids a non-admin', async () => {
    mockAuthState.user = { id: 'u1', userType: 'customer' };
    const res = await request(app).get('/api/analytics/order-status');
    expect(res.status).toBe(403);
    expect(Order.aggregate).not.toHaveBeenCalled();
  });
});

describe('GET /api/analytics/summary', () => {
  it('returns platform totals', async () => {
    (Order.countDocuments as jest.Mock).mockImplementation((filter) => {
      if (!filter) return Promise.resolve(21);
      if (filter.status === 'pending') return Promise.resolve(5);
      if (filter.status === 'delivered') return Promise.resolve(10);
      return Promise.resolve(0);
    });
    (User.countDocuments as jest.Mock).mockResolvedValue(42);

    const res = await request(app).get('/api/analytics/summary');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      totalOrders: 21,
      pendingOrders: 5,
      deliveredOrders: 10,
      totalUsers: 42,
    });
    expect(Order.countDocuments).toHaveBeenCalledWith({ status: 'pending' });
    expect(Order.countDocuments).toHaveBeenCalledWith({ status: 'delivered' });
  });

  it('forbids a non-admin', async () => {
    mockAuthState.user = { id: 'u1', userType: 'customer' };
    const res = await request(app).get('/api/analytics/summary');
    expect(res.status).toBe(403);
    expect(User.countDocuments).not.toHaveBeenCalled();
  });
});

describe('GET /api/analytics/monthly-trends', () => {
  it('returns a dense Jan..current-month series for the current year', async () => {
    (Order.aggregate as jest.Mock).mockResolvedValue([
      { _id: { year: 2026, month: 1 }, count: 5 },
    ]);
    (Query.aggregate as jest.Mock).mockResolvedValue([
      { _id: { year: 2026, month: 1 }, count: 3 },
    ]);

    const res = await request(app).get('/api/analytics/monthly-trends');

    const now = new Date();
    const expectedMonths = Array.from(
      { length: now.getUTCMonth() + 1 },
      (_, i) => i + 1
    );
    expect(res.status).toBe(200);
    expect(res.body.data.year).toBe(now.getUTCFullYear());
    expect(res.body.data.months).toEqual(expectedMonths);
    expect(res.body.data.bookings).toHaveLength(expectedMonths.length);
    expect(res.body.data.queries).toHaveLength(expectedMonths.length);
    // January (index 0) carries the mocked counts.
    expect(res.body.data.bookings[0]).toBe(5);
    expect(res.body.data.queries[0]).toBe(3);
  });

  it('covers all 12 months for a past year and zero-fills empty months', async () => {
    (Order.aggregate as jest.Mock).mockResolvedValue([
      { _id: { year: 2020, month: 3 }, count: 7 },
    ]);
    (Query.aggregate as jest.Mock).mockResolvedValue([]);

    const res = await request(app).get('/api/analytics/monthly-trends?year=2020');

    expect(res.status).toBe(200);
    expect(res.body.data.year).toBe(2020);
    expect(res.body.data.months).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
    ]);
    expect(res.body.data.bookings).toHaveLength(12);
    expect(res.body.data.bookings[2]).toBe(7); // March
    expect(res.body.data.bookings.filter((c: number) => c !== 0)).toEqual([7]);
    expect(res.body.data.queries).toEqual(new Array(12).fill(0));
  });

  it('restricts the aggregation to the requested year', async () => {
    (Order.aggregate as jest.Mock).mockResolvedValue([]);
    (Query.aggregate as jest.Mock).mockResolvedValue([]);

    await request(app).get('/api/analytics/monthly-trends?year=2020');

    const pipeline = (Order.aggregate as jest.Mock).mock.calls[0][0];
    expect(pipeline[0].$match.createdAt.$gte.getUTCFullYear()).toBe(2020);
    expect(pipeline[0].$match.createdAt.$lt.getUTCFullYear()).toBe(2021);
  });

  it('rejects an out-of-range year', async () => {
    const res = await request(app).get('/api/analytics/monthly-trends?year=1000');
    expect(res.status).toBe(400);
    expect(Order.aggregate).not.toHaveBeenCalled();
  });

  it('forbids a non-admin', async () => {
    mockAuthState.user = { id: 'u1', userType: 'customer' };
    const res = await request(app).get('/api/analytics/monthly-trends');
    expect(res.status).toBe(403);
    expect(Order.aggregate).not.toHaveBeenCalled();
  });
});
