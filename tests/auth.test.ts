import request from 'supertest';
import { createApp } from '../src/app';
import { User } from '../src/models/user.model';

const app = createApp();

/**
 * These tests exercise the auth routes without a real database:
 * - validation failures short-circuit before any DB call
 * - the duplicate-email case stubs `User.findOne`
 * - the malformed-JSON case exercises the global error handler
 */
describe('POST /api/auth/login', () => {
  it('rejects a request with no email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ password: 'secret123' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/email/i);
  });

  it('rejects a request with no password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@example.com' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/password/i);
  });

  it('rejects a request missing both email and password', async () => {
    const res = await request(app).post('/api/auth/login').send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/email/i);
    expect(res.body.message).toMatch(/password/i);
  });
});

describe('POST /api/auth/register', () => {
  it('rejects registration missing a required field (email)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'jane', password: 'secret123' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/email/i);
  });

  it('rejects registration when the email already exists', async () => {
    const spy = jest
      .spyOn(User, 'findOne')
      .mockResolvedValue({ email: 'taken@example.com' } as never);

    const res = await request(app).post('/api/auth/register').send({
      username: 'jane',
      email: 'taken@example.com',
      password: 'secret123',
    });

    expect(spy).toHaveBeenCalledWith({ email: 'taken@example.com' });
    expect(res.status).toBe(409);
    expect(res.body.message).toBe('Email is already registered');
  });
});

describe('Malformed JSON handling', () => {
  it('returns a clean 400 instead of a raw SyntaxError', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      // Trailing comma => invalid JSON (the exact case that broke before).
      .send('{ "email": "user@example.com", }');

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Invalid JSON payload in request body');
  });
});
