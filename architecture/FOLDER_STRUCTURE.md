# Folder Structure & "Where do I change X?"

Use this map to find the most relevant file **before** editing. Keep the tree in
sync when you add files.

## Tree

```
gannet/
├── CLAUDE.md                     # Read-first workflow & rules
├── API.md                        # Full REST API reference (every endpoint)
├── architecture/                 # ← design docs (this folder)
│   ├── ARCHITECTURE.md           # System design & decisions
│   ├── FOLDER_STRUCTURE.md       # This file
│   ├── CONVENTIONS.md            # Naming, rules, patterns
│   └── HISTORY.md                # Append-only change log
├── src/
│   ├── index.ts                  # Entry: DB connect + server bootstrap
│   ├── app.ts                    # Express app assembly (middleware order)
│   ├── config/
│   │   ├── env.ts                # Joi-validated env (only place to read env)
│   │   ├── db.ts                 # Mongo connect/disconnect
│   │   └── swagger.ts            # Swagger setup (/api-docs)
│   ├── middlewares/
│   │   ├── auth.ts               # authenticate (JWT) + authorize (roles)
│   │   ├── validate.ts           # Joi validation middleware
│   │   ├── rateLimiter.ts        # apiRateLimiter + authRateLimiter
│   │   ├── notFound.ts           # 404 handler
│   │   └── errorHandler.ts       # Global error handler (registered last)
│   ├── models/
│   │   ├── user.model.ts         # User schema + UserType/UserStatus + hashing
│   │   ├── product.model.ts      # Product schema
│   │   ├── query.model.ts        # Query (public enquiry) schema
│   │   ├── address.model.ts      # Address schema (user ref; many per user)
│   │   └── order.model.ts        # Order schema + OrderStatus + user/address refs
│   ├── routes/
│   │   ├── index.ts              # Route aggregator + /health
│   │   ├── auth/    { index.ts, controller.ts, helpers.ts }
│   │   ├── user/    { index.ts, controller.ts, helpers.ts }
│   │   ├── product/ { index.ts, controller.ts, helpers.ts }
│   │   ├── query/   { index.ts, controller.ts, helpers.ts }  # public POST + admin list
│   │   ├── address/ { index.ts, controller.ts, helpers.ts }  # owner-scoped CRUD
│   │   ├── order/   { index.ts, controller.ts, helpers.ts }  # owner-scoped + admin aggregation search
│   │   └── analytics/ { index.ts, controller.ts, helpers.ts }  # admin dashboards (counts/summary/trends)
│   ├── utils/
│   │   ├── ApiError.ts           # Typed HTTP error class
│   │   ├── catchAsync.ts         # Async handler wrapper
│   │   └── jwt.ts                # signToken / verifyToken (sub = userId)
│   └── types/
│       └── express.d.ts          # Request.user augmentation
├── tests/
│   ├── auth.test.ts              # Auth routes + JSON-error + validation
│   ├── user.test.ts              # User routes (admin aggregation list + search)
│   ├── product.test.ts           # Product routes + pagination
│   ├── query.test.ts             # Query routes (public POST + admin list)
│   ├── query-ratelimit.test.ts   # Real queryRateLimiter → 429 after 5
│   ├── address.test.ts           # Address routes (owner-scoped CRUD, pagination)
│   ├── analytics.test.ts         # Analytics routes (admin counts/summary/trends)
│   ├── cors.test.ts              # CORS policy (allowed origin, credentials, preflight)
│   ├── order.test.ts             # Order routes (ownership, admin aggregation search)
│   ├── protected-routes.test.ts  # Real auth guard → 401 checks
│   ├── api-docs.test.ts          # API.md covers every mounted route (no drift)
│   └── helpers/mockQuery.ts      # Chainable+awaitable Mongoose query mock
├── eslint.config.mjs             # Flat ESLint (max-lines 200, no-unused-vars)
├── jest.config.js                # ts-jest config
├── tsconfig.json                 # strict; ts-node files:true
└── .husky/pre-commit             # lint + test gate
```

## Where do I change X?

| I want to… | Change here |
| --- | --- |
| Add a new resource/route | New `src/routes/<name>/{index,controller,helpers}.ts` + mount in `src/routes/index.ts` + add tests + update HISTORY |
| Add/adjust request validation | That route's `helpers.ts` (Joi schema) |
| Change business logic for an endpoint | That route's `controller.ts` |
| Add/change a URL, middleware order, or Swagger doc for a route | That route's `index.ts` |
| Change a DB field / schema | `src/models/<entity>.model.ts` |
| Change auth / token behaviour | `src/middlewares/auth.ts` and/or `src/utils/jwt.ts` |
| Change how errors are shaped | `src/middlewares/errorHandler.ts` (+ `src/utils/ApiError.ts`) |
| Change rate limits | `src/middlewares/rateLimiter.ts` |
| Add an env var | `src/config/env.ts` (schema) + `.env.example` + `.env` |
| Change global middleware or mounting | `src/app.ts` |
| Change pagination defaults | The list route's `helpers.ts` query schema + its `controller.ts` |
| Add a shared helper/util | `src/utils/` |
| Add an ambient TS type | `src/types/` |

## Naming conventions (quick reference)

- Route folders: lowercase singular (`user`, `product`, `auth`).
- Models: `<entity>.model.ts`; exported model PascalCase (`User`, `Product`).
- Joi schemas: `<action><Entity>Schema` (e.g. `createProductSchema`,
  `listUsersQuerySchema`).
- Tests: `<area>.test.ts` under `tests/`.

Full rules in [`CONVENTIONS.md`](CONVENTIONS.md).
