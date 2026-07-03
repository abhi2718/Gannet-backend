/**
 * Build a fake Mongoose Query that is both chainable (`.sort().skip().limit()`)
 * and awaitable (resolves to `result`). Lets us unit-test controllers without a
 * real database connection.
 */
export const makeQuery = <T>(result: T) => {
  const q: Record<string, unknown> = {};
  for (const method of ['sort', 'skip', 'limit', 'select', 'populate']) {
    q[method] = jest.fn(() => q);
  }
  q.then = (resolve: (v: T) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return q as Record<string, jest.Mock> & PromiseLike<T>;
};
