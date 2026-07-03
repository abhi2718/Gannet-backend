import request from 'supertest';

// Mutable auth state so individual tests can act as a customer or an admin.
// (Prefixed `mock` so jest allows referencing it inside the factory.)
const mockAuthState: { user: { id: string; userType: string } } = {
  user: { id: 'user1', userType: 'customer' },
};

jest.mock('../src/middlewares/auth', () => ({
  authenticate: (req: { user?: unknown }, _res: unknown, next: () => void) => {
    req.user = mockAuthState.user;
    next();
  },
  // Real-ish role gate so we can assert 403 for non-admins.
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
    Order: {
      create: jest.fn(),
      find: jest.fn(),
      countDocuments: jest.fn(),
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
    },
  };
});

import { createApp } from '../src/app';
import { Order, OrderStatus } from '../src/models/order.model';
import { makeQuery } from './helpers/mockQuery';

const app = createApp();
const VALID_ID = '507f1f77bcf86cd799439011';
const validBody = { itemName: 'Widget', quantity: 2, amount: 49.99 };

beforeEach(() => {
  mockAuthState.user = { id: 'user1', userType: 'customer' };
});

describe('POST /api/orders', () => {
  it('creates an order owned by the current user with default status', async () => {
    (Order.create as jest.Mock).mockResolvedValue({
      id: 'o1',
      ...validBody,
      status: OrderStatus.ORDER_PLACED,
    });

    const res = await request(app).post('/api/orders').send(validBody);

    expect(res.status).toBe(201);
    expect(Order.create).toHaveBeenCalledWith(
      expect.objectContaining({ ...validBody, user: 'user1' })
    );
  });

  it.each(['itemName', 'quantity', 'amount'])(
    'rejects when required field "%s" is missing',
    async (field) => {
      const body: Record<string, unknown> = { ...validBody };
      delete body[field];
      const res = await request(app).post('/api/orders').send(body);
      expect(res.status).toBe(400);
      expect(res.body.message).toContain(field);
    }
  );

  it('rejects a quantity below 1', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({ ...validBody, quantity: 0 });
    expect(res.status).toBe(400);
  });

  it('rejects a negative amount', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({ ...validBody, amount: -5 });
    expect(res.status).toBe(400);
  });

  it('rejects an invalid estimatedDelivery date', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({ ...validBody, estimatedDelivery: 'not-a-date' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/orders/my (own orders, paginated)', () => {
  it('returns only the caller\'s own orders', async () => {
    const query = makeQuery([{ id: 'o1', ...validBody }]);
    (Order.find as jest.Mock).mockReturnValue(query);
    (Order.countDocuments as jest.Mock).mockResolvedValue(1);

    const res = await request(app).get('/api/orders/my');

    expect(res.status).toBe(200);
    expect(Order.find).toHaveBeenCalledWith({ user: 'user1' });
    expect(Order.countDocuments).toHaveBeenCalledWith({ user: 'user1' });
    expect(query.skip).toHaveBeenCalledWith(0);
    expect(query.limit).toHaveBeenCalledWith(20);
    expect(res.body.pagination.limit).toBe(20);
  });

  it('an admin still only sees their own orders on /my', async () => {
    mockAuthState.user = { id: 'admin1', userType: 'admin' };
    const query = makeQuery([]);
    (Order.find as jest.Mock).mockReturnValue(query);
    (Order.countDocuments as jest.Mock).mockResolvedValue(0);

    const res = await request(app).get('/api/orders/my');

    expect(res.status).toBe(200);
    expect(Order.find).toHaveBeenCalledWith({ user: 'admin1' });
  });

  it('rejects a page size below the minimum of 20', async () => {
    const res = await request(app).get('/api/orders/my?limit=5');
    expect(res.status).toBe(400);
    expect(Order.find).not.toHaveBeenCalled();
  });
});

describe('GET /api/orders (all orders, admin only)', () => {
  it('lets an admin list every order, paginated', async () => {
    mockAuthState.user = { id: 'admin1', userType: 'admin' };
    const query = makeQuery([{ id: 'o1' }, { id: 'o2' }]);
    (Order.find as jest.Mock).mockReturnValue(query);
    (Order.countDocuments as jest.Mock).mockResolvedValue(2);

    const res = await request(app).get('/api/orders?page=2&limit=25');

    expect(res.status).toBe(200);
    expect(Order.find).toHaveBeenCalledWith({});
    expect(query.skip).toHaveBeenCalledWith(25);
    expect(query.limit).toHaveBeenCalledWith(25);
  });

  it('forbids a customer from listing all orders', async () => {
    const res = await request(app).get('/api/orders');
    expect(res.status).toBe(403);
    expect(Order.find).not.toHaveBeenCalled();
  });

  it('rejects a page size below the minimum of 20 (admin)', async () => {
    mockAuthState.user = { id: 'admin1', userType: 'admin' };
    const res = await request(app).get('/api/orders?limit=5');
    expect(res.status).toBe(400);
    expect(Order.find).not.toHaveBeenCalled();
  });
});

describe('GET /api/orders/:id', () => {
  it('returns the order when the customer owns it', async () => {
    (Order.findById as jest.Mock).mockResolvedValue({
      id: 'o1',
      user: 'user1',
    });
    const res = await request(app).get(`/api/orders/${VALID_ID}`);
    expect(res.status).toBe(200);
  });

  it("forbids a customer from viewing someone else's order", async () => {
    (Order.findById as jest.Mock).mockResolvedValue({
      id: 'o1',
      user: 'user2',
    });
    const res = await request(app).get(`/api/orders/${VALID_ID}`);
    expect(res.status).toBe(403);
  });

  it('lets an admin view any order', async () => {
    mockAuthState.user = { id: 'admin1', userType: 'admin' };
    (Order.findById as jest.Mock).mockResolvedValue({
      id: 'o1',
      user: 'user2',
    });
    const res = await request(app).get(`/api/orders/${VALID_ID}`);
    expect(res.status).toBe(200);
  });

  it('returns 404 when the order does not exist', async () => {
    (Order.findById as jest.Mock).mockResolvedValue(null);
    const res = await request(app).get(`/api/orders/${VALID_ID}`);
    expect(res.status).toBe(404);
  });

  it('returns 400 for a malformed id', async () => {
    const res = await request(app).get('/api/orders/not-an-id');
    expect(res.status).toBe(400);
  });
});

describe('PATCH /api/orders/:id/status', () => {
  it('lets an admin update the status', async () => {
    mockAuthState.user = { id: 'admin1', userType: 'admin' };
    (Order.findByIdAndUpdate as jest.Mock).mockResolvedValue({
      id: 'o1',
      status: OrderStatus.DELIVERED,
    });

    const res = await request(app)
      .patch(`/api/orders/${VALID_ID}/status`)
      .send({ status: 'delivered' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('delivered');
  });

  it('rejects an invalid status value', async () => {
    mockAuthState.user = { id: 'admin1', userType: 'admin' };
    const res = await request(app)
      .patch(`/api/orders/${VALID_ID}/status`)
      .send({ status: 'shipped' });
    expect(res.status).toBe(400);
  });

  it('returns 404 when updating a missing order', async () => {
    mockAuthState.user = { id: 'admin1', userType: 'admin' };
    (Order.findByIdAndUpdate as jest.Mock).mockResolvedValue(null);
    const res = await request(app)
      .patch(`/api/orders/${VALID_ID}/status`)
      .send({ status: 'confirmed' });
    expect(res.status).toBe(404);
  });

  it('forbids a non-admin from updating status', async () => {
    const res = await request(app)
      .patch(`/api/orders/${VALID_ID}/status`)
      .send({ status: 'confirmed' });
    expect(res.status).toBe(403);
    expect(Order.findByIdAndUpdate).not.toHaveBeenCalled();
  });
});
