import fs from 'fs';
import path from 'path';

/**
 * Keeps API.md honest: every route the app mounts must be documented, the doc
 * must not describe routes that don't exist, and the key global sections must be
 * present. If you add/remove an endpoint, update both the router and this list.
 */
const API_DOC = fs.readFileSync(
  path.join(__dirname, '..', 'API.md'),
  'utf8'
);

const endpoints: Array<[string, string]> = [
  ['POST', '/api/auth/register'],
  ['POST', '/api/auth/login'],
  ['GET', '/api/auth/me'],
  ['GET', '/api/users'],
  ['GET', '/api/users/:id'],
  ['PATCH', '/api/users/:id'],
  ['DELETE', '/api/users/:id'],
  ['GET', '/api/products'],
  ['POST', '/api/products'],
  ['GET', '/api/products/:id'],
  ['PATCH', '/api/products/:id'],
  ['DELETE', '/api/products/:id'],
  ['POST', '/api/queries'],
  ['GET', '/api/queries'],
  ['PATCH', '/api/queries/:id'],
  ['DELETE', '/api/queries/:id'],
  ['GET', '/api/addresses'],
  ['POST', '/api/addresses'],
  ['GET', '/api/addresses/:id'],
  ['PATCH', '/api/addresses/:id'],
  ['DELETE', '/api/addresses/:id'],
  ['POST', '/api/orders'],
  ['GET', '/api/orders'],
  ['GET', '/api/orders/my'],
  ['GET', '/api/orders/:id'],
  ['PATCH', '/api/orders/:id'],
  ['PATCH', '/api/orders/:id/status'],
  ['DELETE', '/api/orders/:id'],
  ['GET', '/api/analytics/my-orders'],
  ['GET', '/api/analytics/order-status'],
  ['GET', '/api/analytics/summary'],
  ['GET', '/api/analytics/monthly-trends'],
  ['GET', '/api/health'],
];

describe('API.md documentation coverage', () => {
  it.each(endpoints)('documents %s %s', (method, route) => {
    expect(API_DOC).toContain(`\`${method} ${route}\``);
  });

  it('documents exactly the mounted endpoints (no drift)', () => {
    const headings =
      API_DOC.match(/^### `(?:GET|POST|PATCH|PUT|DELETE) \/api/gm) ?? [];
    expect(headings).toHaveLength(endpoints.length);
  });

  it.each([
    '## Conventions',
    '### Success shape',
    '### Error shape',
    '### Authentication',
    '### Rate limiting',
    '### Pagination',
    '## Data models',
  ])('includes the "%s" section', (heading) => {
    expect(API_DOC).toContain(heading);
  });

  it.each([
    '## Auth',
    '## Users',
    '## Products',
    '## Queries',
    '## Addresses',
    '## Orders',
    '## Analytics',
    '## System',
  ])('includes the "%s" resource group', (group) => {
    expect(API_DOC).toContain(group);
  });

  it('documents the standard error shape', () => {
    expect(API_DOC).toContain('"success": false');
  });
});
