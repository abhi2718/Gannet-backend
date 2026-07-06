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
      aggregate: jest.fn(),
      countDocuments: jest.fn(),
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      findByIdAndDelete: jest.fn(),
    },
  };
});

jest.mock('../src/models/address.model', () => ({
  __esModule: true,
  Address: { findOne: jest.fn() },
}));

import { createApp } from '../src/app';
import { Address } from '../src/models/address.model';
import { Order, OrderStatus } from '../src/models/order.model';
import { makeQuery } from './helpers/mockQuery';

const app = createApp();
const VALID_ID = '507f1f77bcf86cd799439011';
const ADDRESS_ID = '507f1f77bcf86cd799439099';
// Two product lines → total = 2*50 + 3*10 = 130.
const validItems = [
  { bottleSize: '20L', quantity: 2, amount: 50 },
  { bottleSize: '1L', quantity: 3, amount: 10 },
];
const validBody = {
  customerName: 'John Doe',
  customerPhone: '+12025550123',
  items: validItems,
  address: ADDRESS_ID,
};

beforeEach(() => {
  mockAuthState.user = { id: 'user1', userType: 'customer' };
  // By default the referenced address exists and belongs to the caller.
  (Address.findOne as jest.Mock).mockResolvedValue({
    id: 'addr1',
    user: 'user1',
  });
});

describe('POST /api/orders', () => {
  it('creates an order owned by the current user with default status', async () => {
    (Order.create as jest.Mock).mockResolvedValue({
      id: 'o1',
      ...validBody,
      status: OrderStatus.PENDING,
    });

    const res = await request(app).post('/api/orders').send(validBody);

    expect(res.status).toBe(201);
    // The referenced address is verified to belong to the caller.
    expect(Address.findOne).toHaveBeenCalledWith({
      _id: ADDRESS_ID,
      user: 'user1',
    });
    // Server computes the total (Σ quantity × amount) — never trusts the client.
    expect(Order.create).toHaveBeenCalledWith(
      expect.objectContaining({ ...validBody, user: 'user1', totalAmount: 130 })
    );
  });

  it.each(['customerName', 'customerPhone', 'items', 'address'])(
    'rejects when required field "%s" is missing',
    async (field) => {
      const body: Record<string, unknown> = { ...validBody };
      delete body[field];
      const res = await request(app).post('/api/orders').send(body);
      expect(res.status).toBe(400);
      expect(res.body.message).toContain(field);
      expect(Order.create).not.toHaveBeenCalled();
    }
  );

  it('rejects an empty items array', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({ ...validBody, items: [] });
    expect(res.status).toBe(400);
    expect(Order.create).not.toHaveBeenCalled();
  });

  it.each(['bottleSize', 'quantity', 'amount'])(
    'rejects when an item is missing "%s"',
    async (field) => {
      const item: Record<string, unknown> = { ...validItems[0] };
      delete item[field];
      const res = await request(app)
        .post('/api/orders')
        .send({ ...validBody, items: [item] });
      expect(res.status).toBe(400);
      expect(Order.create).not.toHaveBeenCalled();
    }
  );

  it('rejects a malformed address id', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({ ...validBody, address: 'not-an-id' });
    expect(res.status).toBe(400);
    expect(Order.create).not.toHaveBeenCalled();
  });

  it('rejects an address that does not belong to the caller', async () => {
    (Address.findOne as jest.Mock).mockResolvedValue(null);
    const res = await request(app).post('/api/orders').send(validBody);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/address/i);
    expect(Order.create).not.toHaveBeenCalled();
  });

  it('rejects an item quantity below 1', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({ ...validBody, items: [{ bottleSize: '20L', quantity: 0, amount: 5 }] });
    expect(res.status).toBe(400);
    expect(Order.create).not.toHaveBeenCalled();
  });

  it('rejects a negative item amount', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({ ...validBody, items: [{ bottleSize: '20L', quantity: 1, amount: -5 }] });
    expect(res.status).toBe(400);
    expect(Order.create).not.toHaveBeenCalled();
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

  it('searches own orders by name/phone/item bottleSize + status + date', async () => {
    const query = makeQuery([]);
    (Order.find as jest.Mock).mockReturnValue(query);
    (Order.countDocuments as jest.Mock).mockResolvedValue(0);

    await request(app).get(
      '/api/orders/my?search=John&status=confirmed' +
        '&dateFrom=2026-01-01&dateTo=2026-12-31'
    );

    const arg = (Order.find as jest.Mock).mock.calls[0][0];
    expect(arg.user).toBe('user1');
    expect(arg.status).toBe('confirmed');
    expect(arg.$or).toHaveLength(3);
    expect(arg.$or[0].customerName.$regex).toBe('John');
    expect(arg.$or[2]['items.bottleSize'].$regex).toBe('John');
    expect(arg.createdAt.$gte).toBeInstanceOf(Date);
    expect(arg.createdAt.$lte).toBeInstanceOf(Date);
  });

  it('rejects an invalid status filter value', async () => {
    const res = await request(app).get('/api/orders/my?status=shipped');
    expect(res.status).toBe(400);
    expect(Order.find).not.toHaveBeenCalled();
  });
});

describe('GET /api/orders (all orders, admin only, aggregation search)', () => {
  type Stage = Record<string, any>;
  const lastPipeline = (): Stage[] =>
    (Order.aggregate as jest.Mock).mock.calls[0][0];
  const facetOf = (pipeline: Stage[]): Stage =>
    pipeline.find((s) => s.$facet)?.$facet;
  const searchOrOf = (pipeline: Stage[]): Stage[] | undefined =>
    pipeline.find((s) => s.$match && s.$match.$or)?.$match.$or;

  beforeEach(() => {
    mockAuthState.user = { id: 'admin1', userType: 'admin' };
    (Order.aggregate as jest.Mock).mockResolvedValue([
      { data: [], totalCount: [] },
    ]);
  });

  it('lets an admin list every order, paginated', async () => {
    (Order.aggregate as jest.Mock).mockResolvedValue([
      { data: [{ _id: 'o1' }, { _id: 'o2' }], totalCount: [{ count: 2 }] },
    ]);

    const res = await request(app).get('/api/orders?page=2&limit=25');

    expect(res.status).toBe(200);
    expect(Order.aggregate).toHaveBeenCalled();
    expect(res.body.data).toHaveLength(2);
    expect(res.body.pagination).toMatchObject({ total: 2, page: 2, limit: 25 });

    const facet = facetOf(lastPipeline());
    expect(facet.data).toContainEqual({ $skip: 25 });
    expect(facet.data).toContainEqual({ $limit: 25 });
  });

  it('joins the user and address collections', async () => {
    await request(app).get('/api/orders');

    const lookups = lastPipeline()
      .filter((s) => s.$lookup)
      .map((s) => s.$lookup.from);
    expect(lookups).toEqual(expect.arrayContaining(['users', 'addresses']));
  });

  it('searches across order, user and address fields', async () => {
    await request(app).get('/api/orders?search=9876543210');

    const or = searchOrOf(lastPipeline()) ?? [];
    const fields = or.map((c) => Object.keys(c)[0]);
    expect(fields).toEqual(
      expect.arrayContaining([
        'customerName',
        'customerPhone',
        'items.bottleSize',
        'user.username',
        'user.email',
        'user.phoneNumber',
        'address.street',
        'address.city',
        'address.pinCode',
        'address.landmark',
      ])
    );
    expect(or[1].customerPhone.$regex).toBe('9876543210');
  });

  it('escapes regex metacharacters in the admin search term', async () => {
    await request(app).get('/api/orders?search=a.%2Ab'); // "a.*b"

    const or = searchOrOf(lastPipeline()) ?? [];
    expect(or[0].customerName.$regex).toBe('a\\.\\*b');
  });

  it('applies the status filter before the joins', async () => {
    await request(app).get('/api/orders?status=delivered');
    expect(lastPipeline()[0].$match.status).toBe('delivered');
  });

  it('forbids a customer from listing all orders', async () => {
    mockAuthState.user = { id: 'user1', userType: 'customer' };
    const res = await request(app).get('/api/orders');
    expect(res.status).toBe(403);
    expect(Order.aggregate).not.toHaveBeenCalled();
  });

  it('rejects an invalid status filter value (admin)', async () => {
    const res = await request(app).get('/api/orders?status=shipped');
    expect(res.status).toBe(400);
    expect(Order.aggregate).not.toHaveBeenCalled();
  });

  it('rejects a page size below the minimum of 20 (admin)', async () => {
    const res = await request(app).get('/api/orders?limit=5');
    expect(res.status).toBe(400);
    expect(Order.aggregate).not.toHaveBeenCalled();
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

describe('PATCH /api/orders/:id (admin edit)', () => {
  beforeEach(() => {
    mockAuthState.user = { id: 'admin1', userType: 'admin' };
  });

  it('lets an admin edit order fields', async () => {
    (Order.findByIdAndUpdate as jest.Mock).mockResolvedValue({
      id: 'o1',
      status: 'cancelled',
    });

    const res = await request(app)
      .patch(`/api/orders/${VALID_ID}`)
      .send({ customerName: 'Jane Roe', status: 'cancelled' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('cancelled');
  });

  it('recomputes totalAmount when items are edited', async () => {
    (Order.findByIdAndUpdate as jest.Mock).mockResolvedValue({ id: 'o1' });

    await request(app)
      .patch(`/api/orders/${VALID_ID}`)
      .send({ items: [{ bottleSize: '5L', quantity: 4, amount: 25 }] });

    // 4 * 25 = 100 is written alongside the new items.
    const update = (Order.findByIdAndUpdate as jest.Mock).mock.calls[0][1];
    expect(update.totalAmount).toBe(100);
  });

  it('rejects an empty update body', async () => {
    const res = await request(app).patch(`/api/orders/${VALID_ID}`).send({});
    expect(res.status).toBe(400);
  });

  it('rejects an empty items array on edit', async () => {
    const res = await request(app)
      .patch(`/api/orders/${VALID_ID}`)
      .send({ items: [] });
    expect(res.status).toBe(400);
    expect(Order.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('rejects an invalid status', async () => {
    const res = await request(app)
      .patch(`/api/orders/${VALID_ID}`)
      .send({ status: 'shipped' });
    expect(res.status).toBe(400);
  });

  it('returns 404 when editing a missing order', async () => {
    (Order.findByIdAndUpdate as jest.Mock).mockResolvedValue(null);
    const res = await request(app)
      .patch(`/api/orders/${VALID_ID}`)
      .send({ customerName: 'Jane Roe' });
    expect(res.status).toBe(404);
  });

  it('returns 400 for a malformed id', async () => {
    const res = await request(app)
      .patch('/api/orders/not-an-id')
      .send({ customerName: 'Jane Roe' });
    expect(res.status).toBe(400);
  });

  it('forbids a non-admin from editing', async () => {
    mockAuthState.user = { id: 'user1', userType: 'customer' };
    const res = await request(app)
      .patch(`/api/orders/${VALID_ID}`)
      .send({ customerName: 'Jane Roe' });
    expect(res.status).toBe(403);
    expect(Order.findByIdAndUpdate).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/orders/:id (admin)', () => {
  beforeEach(() => {
    mockAuthState.user = { id: 'admin1', userType: 'admin' };
  });

  it('lets an admin delete an order', async () => {
    (Order.findByIdAndDelete as jest.Mock).mockResolvedValue({ id: 'o1' });
    const res = await request(app).delete(`/api/orders/${VALID_ID}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 404 when deleting a missing order', async () => {
    (Order.findByIdAndDelete as jest.Mock).mockResolvedValue(null);
    const res = await request(app).delete(`/api/orders/${VALID_ID}`);
    expect(res.status).toBe(404);
  });

  it('returns 400 for a malformed id', async () => {
    const res = await request(app).delete('/api/orders/not-an-id');
    expect(res.status).toBe(400);
  });

  it('forbids a non-admin from deleting', async () => {
    mockAuthState.user = { id: 'user1', userType: 'customer' };
    const res = await request(app).delete(`/api/orders/${VALID_ID}`);
    expect(res.status).toBe(403);
    expect(Order.findByIdAndDelete).not.toHaveBeenCalled();
  });
});
