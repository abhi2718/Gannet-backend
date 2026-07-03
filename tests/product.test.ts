import request from 'supertest';

// Bypass JWT/DB auth: the middleware just injects a user.
jest.mock('../src/middlewares/auth', () => ({
  authenticate: (req: { user?: unknown }, _res: unknown, next: () => void) => {
    req.user = { id: '507f1f77bcf86cd799439011', userType: 'customer' };
    next();
  },
  authorize: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

jest.mock('../src/models/product.model', () => ({
  __esModule: true,
  Product: {
    create: jest.fn(),
    find: jest.fn(),
    countDocuments: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findByIdAndDelete: jest.fn(),
  },
}));

import { createApp } from '../src/app';
import { Product } from '../src/models/product.model';
import { makeQuery } from './helpers/mockQuery';

const app = createApp();
const VALID_ID = '507f1f77bcf86cd799439011';
const validBody = {
  productName: 'Widget',
  url: 'https://example.com/widget',
  price: 9.99,
  description: 'A very fine widget.',
};

describe('POST /api/products', () => {
  it('creates a product owned by the authenticated user', async () => {
    (Product.create as jest.Mock).mockResolvedValue({ id: 'p1', ...validBody });

    const res = await request(app).post('/api/products').send(validBody);

    expect(res.status).toBe(201);
    expect(Product.create).toHaveBeenCalledWith(
      expect.objectContaining({ ...validBody, createdBy: VALID_ID })
    );
  });

  it('rejects a product missing the price', async () => {
    const { price: _price, ...noPrice } = validBody;
    const res = await request(app).post('/api/products').send(noPrice);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/price/i);
    expect(Product.create).not.toHaveBeenCalled();
  });

  it('rejects an invalid url', async () => {
    const res = await request(app)
      .post('/api/products')
      .send({ ...validBody, url: 'not-a-url' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/url/i);
  });
});

describe('GET /api/products (pagination)', () => {
  it('returns page 1 with a default page size of 20', async () => {
    const query = makeQuery([{ id: 'p1', ...validBody }]);
    (Product.find as jest.Mock).mockReturnValue(query);
    (Product.countDocuments as jest.Mock).mockResolvedValue(42);

    const res = await request(app).get('/api/products');

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);
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
    const query = makeQuery([{ id: 'p1', ...validBody }]);
    (Product.find as jest.Mock).mockReturnValue(query);
    (Product.countDocuments as jest.Mock).mockResolvedValue(100);

    const res = await request(app).get('/api/products?page=3&limit=20');

    expect(res.status).toBe(200);
    expect(query.skip).toHaveBeenCalledWith(40);
    expect(query.limit).toHaveBeenCalledWith(20);
    expect(res.body.pagination.page).toBe(3);
  });

  it('rejects a page size below the minimum of 20', async () => {
    const res = await request(app).get('/api/products?limit=5');

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/limit/i);
    expect(Product.find).not.toHaveBeenCalled();
  });
});

describe('GET /api/products/:id', () => {
  it('returns a product when found', async () => {
    (Product.findById as jest.Mock).mockResolvedValue({ id: 'p1', ...validBody });

    const res = await request(app).get(`/api/products/${VALID_ID}`);

    expect(res.status).toBe(200);
    expect(res.body.data.productName).toBe('Widget');
  });

  it('returns 404 when not found', async () => {
    (Product.findById as jest.Mock).mockResolvedValue(null);

    const res = await request(app).get(`/api/products/${VALID_ID}`);

    expect(res.status).toBe(404);
  });

  it('returns 400 for a malformed id', async () => {
    const res = await request(app).get('/api/products/xyz');

    expect(res.status).toBe(400);
  });
});

describe('PATCH /api/products/:id', () => {
  it('updates a product', async () => {
    (Product.findByIdAndUpdate as jest.Mock).mockResolvedValue({
      id: 'p1',
      ...validBody,
      price: 12.5,
    });

    const res = await request(app)
      .patch(`/api/products/${VALID_ID}`)
      .send({ price: 12.5 });

    expect(res.status).toBe(200);
    expect(res.body.data.price).toBe(12.5);
  });

  it('returns 404 when updating a missing product', async () => {
    (Product.findByIdAndUpdate as jest.Mock).mockResolvedValue(null);

    const res = await request(app)
      .patch(`/api/products/${VALID_ID}`)
      .send({ price: 1 });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/products/:id', () => {
  it('deletes a product', async () => {
    (Product.findByIdAndDelete as jest.Mock).mockResolvedValue({ id: 'p1' });

    const res = await request(app).delete(`/api/products/${VALID_ID}`);

    expect(res.status).toBe(200);
  });

  it('returns 404 when deleting a missing product', async () => {
    (Product.findByIdAndDelete as jest.Mock).mockResolvedValue(null);

    const res = await request(app).delete(`/api/products/${VALID_ID}`);

    expect(res.status).toBe(404);
  });
});
