import request from 'supertest';

// Mutable auth state so individual tests can act as a customer or an admin.
const mockAuthState: { user: { id: string; userType: string } } = {
  user: { id: 'user1', userType: 'customer' },
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

jest.mock('../src/models/address.model', () => ({
  __esModule: true,
  Address: {
    create: jest.fn(),
    find: jest.fn(),
    countDocuments: jest.fn(),
    findById: jest.fn(),
  },
}));

import { createApp } from '../src/app';
import { Address } from '../src/models/address.model';
import { makeQuery } from './helpers/mockQuery';

const app = createApp();
const VALID_ID = '507f1f77bcf86cd799439011';
const validBody = {
  street: '221B Baker Street',
  pinCode: '110011',
  city: 'London',
};

// A stored address document owned by `user1` with save/delete spies.
const ownedDoc = () => ({
  id: 'addr1',
  user: 'user1',
  ...validBody,
  save: jest.fn().mockResolvedValue(undefined),
  deleteOne: jest.fn().mockResolvedValue(undefined),
});

beforeEach(() => {
  mockAuthState.user = { id: 'user1', userType: 'customer' };
  jest.clearAllMocks();
});

describe('POST /api/addresses', () => {
  it('creates an address owned by the current user', async () => {
    (Address.create as jest.Mock).mockResolvedValue({ id: 'addr1', ...validBody });

    const res = await request(app).post('/api/addresses').send(validBody);

    expect(res.status).toBe(201);
    expect(Address.create).toHaveBeenCalledWith(
      expect.objectContaining({ ...validBody, user: 'user1' })
    );
  });

  it('accepts an optional landmark', async () => {
    (Address.create as jest.Mock).mockResolvedValue({ id: 'addr1' });
    const res = await request(app)
      .post('/api/addresses')
      .send({ ...validBody, landmark: 'Near the museum' });
    expect(res.status).toBe(201);
    expect(Address.create).toHaveBeenCalledWith(
      expect.objectContaining({ landmark: 'Near the museum' })
    );
  });

  it.each(['street', 'pinCode', 'city'])(
    'rejects when required field "%s" is missing',
    async (field) => {
      const body: Record<string, unknown> = { ...validBody };
      delete body[field];
      const res = await request(app).post('/api/addresses').send(body);
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain(field);
    }
  );

  it('strips unknown fields before persisting', async () => {
    (Address.create as jest.Mock).mockResolvedValue({ id: 'addr1' });
    await request(app)
      .post('/api/addresses')
      .send({ ...validBody, hacker: 'x' });
    const arg = (Address.create as jest.Mock).mock.calls[0][0];
    expect(arg).not.toHaveProperty('hacker');
  });

  it('returns a clean 400 on malformed JSON', async () => {
    const res = await request(app)
      .post('/api/addresses')
      .set('Content-Type', 'application/json')
      .send('{ "street": "x", }');
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Invalid JSON payload in request body');
  });
});

describe('GET /api/addresses (own, paginated)', () => {
  it('lists only the caller\'s own addresses with defaults', async () => {
    const query = makeQuery([{ id: 'addr1', ...validBody }]);
    (Address.find as jest.Mock).mockReturnValue(query);
    (Address.countDocuments as jest.Mock).mockResolvedValue(1);

    const res = await request(app).get('/api/addresses');

    expect(res.status).toBe(200);
    expect(Address.find).toHaveBeenCalledWith({ user: 'user1' });
    expect(Address.countDocuments).toHaveBeenCalledWith({ user: 'user1' });
    expect(query.skip).toHaveBeenCalledWith(0);
    expect(query.limit).toHaveBeenCalledWith(20);
    expect(res.body.pagination.limit).toBe(20);
  });

  it('honours custom page and limit', async () => {
    const query = makeQuery([]);
    (Address.find as jest.Mock).mockReturnValue(query);
    (Address.countDocuments as jest.Mock).mockResolvedValue(0);

    await request(app).get('/api/addresses?page=3&limit=25');

    expect(query.skip).toHaveBeenCalledWith(50);
    expect(query.limit).toHaveBeenCalledWith(25);
  });

  it('rejects a page size below the minimum of 20', async () => {
    const res = await request(app).get('/api/addresses?limit=5');
    expect(res.status).toBe(400);
    expect(Address.find).not.toHaveBeenCalled();
  });
});

describe('GET /api/addresses/:id', () => {
  it('returns the address when the customer owns it', async () => {
    (Address.findById as jest.Mock).mockResolvedValue(ownedDoc());
    const res = await request(app).get(`/api/addresses/${VALID_ID}`);
    expect(res.status).toBe(200);
  });

  it("forbids a customer from viewing someone else's address", async () => {
    (Address.findById as jest.Mock).mockResolvedValue({
      id: 'addr1',
      user: 'user2',
    });
    const res = await request(app).get(`/api/addresses/${VALID_ID}`);
    expect(res.status).toBe(403);
  });

  it('lets an admin view any address', async () => {
    mockAuthState.user = { id: 'admin1', userType: 'admin' };
    (Address.findById as jest.Mock).mockResolvedValue({
      id: 'addr1',
      user: 'user2',
    });
    const res = await request(app).get(`/api/addresses/${VALID_ID}`);
    expect(res.status).toBe(200);
  });

  it('returns 404 when the address does not exist', async () => {
    (Address.findById as jest.Mock).mockResolvedValue(null);
    const res = await request(app).get(`/api/addresses/${VALID_ID}`);
    expect(res.status).toBe(404);
  });

  it('returns 400 for a malformed id', async () => {
    const res = await request(app).get('/api/addresses/not-an-id');
    expect(res.status).toBe(400);
    expect(Address.findById).not.toHaveBeenCalled();
  });
});

describe('PATCH /api/addresses/:id', () => {
  it('updates an address the caller owns', async () => {
    const doc = ownedDoc();
    (Address.findById as jest.Mock).mockResolvedValue(doc);

    const res = await request(app)
      .patch(`/api/addresses/${VALID_ID}`)
      .send({ city: 'Paris' });

    expect(res.status).toBe(200);
    expect(doc.save).toHaveBeenCalled();
    expect(res.body.data.city).toBe('Paris');
  });

  it('rejects an empty update body', async () => {
    const res = await request(app).patch(`/api/addresses/${VALID_ID}`).send({});
    expect(res.status).toBe(400);
    expect(Address.findById).not.toHaveBeenCalled();
  });

  it("forbids editing someone else's address", async () => {
    (Address.findById as jest.Mock).mockResolvedValue({
      id: 'addr1',
      user: 'user2',
      save: jest.fn(),
    });
    const res = await request(app)
      .patch(`/api/addresses/${VALID_ID}`)
      .send({ city: 'Paris' });
    expect(res.status).toBe(403);
  });

  it('returns 404 when editing a missing address', async () => {
    (Address.findById as jest.Mock).mockResolvedValue(null);
    const res = await request(app)
      .patch(`/api/addresses/${VALID_ID}`)
      .send({ city: 'Paris' });
    expect(res.status).toBe(404);
  });

  it('returns 400 for a malformed id', async () => {
    const res = await request(app)
      .patch('/api/addresses/not-an-id')
      .send({ city: 'Paris' });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/addresses/:id', () => {
  it('deletes an address the caller owns', async () => {
    const doc = ownedDoc();
    (Address.findById as jest.Mock).mockResolvedValue(doc);
    const res = await request(app).delete(`/api/addresses/${VALID_ID}`);
    expect(res.status).toBe(200);
    expect(doc.deleteOne).toHaveBeenCalled();
    expect(res.body.success).toBe(true);
  });

  it("forbids deleting someone else's address", async () => {
    (Address.findById as jest.Mock).mockResolvedValue({
      id: 'addr1',
      user: 'user2',
      deleteOne: jest.fn(),
    });
    const res = await request(app).delete(`/api/addresses/${VALID_ID}`);
    expect(res.status).toBe(403);
  });

  it('returns 404 when deleting a missing address', async () => {
    (Address.findById as jest.Mock).mockResolvedValue(null);
    const res = await request(app).delete(`/api/addresses/${VALID_ID}`);
    expect(res.status).toBe(404);
  });

  it('returns 400 for a malformed id', async () => {
    const res = await request(app).delete('/api/addresses/not-an-id');
    expect(res.status).toBe(400);
  });
});
