# Gannet — Architecture

A layered **Node.js + Express + MongoDB** REST API in **TypeScript**. The design
favours small, single-responsibility files and a repeatable per-route structure.

## Tech stack

| Concern | Choice |
| --- | --- |
| Language | TypeScript (strict) |
| HTTP framework | Express 4 |
| Database / ODM | MongoDB / Mongoose 8 |
| Validation | Joi (via a `validate` middleware) |
| Auth | JWT (`jsonwebtoken`), Bearer tokens |
| Password hashing | bcryptjs |
| Security | helmet, cors, express-mongo-sanitize, express-rate-limit |
| Docs | swagger-jsdoc + swagger-ui-express (`/api-docs`) |
| Tests | Jest + supertest (mocked persistence) |
| Lint / hooks | ESLint (flat config) + Husky pre-commit |

## Layers (request → response)

```
HTTP request
  │
  ▼
app.ts  ──►  helmet · cors · json · mongoSanitize · rateLimiter   (global middleware)
  │
  ▼
routes/index.ts  ──►  mounts /auth, /users, /products, /health
  │
  ▼
routes/<entity>/index.ts   (Router + @openapi docs)
  │   authenticate (JWT) → authorize(...) → validate(schema) →
  ▼
routes/<entity>/controller.ts   (handler, wrapped in catchAsync)
  │   uses helpers.ts (Joi schemas) + models/<entity>.model.ts
  ▼
models/*  ──►  MongoDB
  │
  ▼
errorHandler (global)  ──►  consistent JSON error   ·   notFound → 404
```

## Responsibilities by layer

- **`src/index.ts`** — process entry: connect DB, start server, graceful shutdown.
- **`src/app.ts`** — builds the Express app (middleware order, routes, 404,
  error handler). Kept separate from `index.ts` so tests import the app without
  opening a DB connection or a port.
- **`src/config/`** — `env.ts` (Joi-validated env, single source of truth — never
  read `process.env` elsewhere), `db.ts` (Mongo connect/disconnect), `swagger.ts`.
- **`src/middlewares/`** — cross-cutting concerns: `auth` (JWT + roles),
  `validate` (Joi), `rateLimiter`, `notFound`, `errorHandler`.
- **`src/models/`** — Mongoose schemas + document interfaces. Password hashing
  and `toJSON` scrubbing live on the `User` model.
- **`src/routes/<entity>/`** — one folder per resource, always three files
  (`index`, `controller`, `helpers`). See CONVENTIONS.md.
- **`src/utils/`** — `ApiError` (typed HTTP errors), `catchAsync` (async wrapper),
  `jwt` (sign/verify; payload = `{ sub: userId }` only).
- **`src/types/`** — ambient TS augmentations (e.g. `Request.user`).

## Key design decisions

- **JWT holds only the Mongo user id** (`sub`). The `authenticate` middleware
  re-loads the user from the DB on every request and attaches it to `req.user`,
  so revoked/changed users take effect immediately.
- **Errors are centralised.** Handlers throw `ApiError` (or let Mongoose/JSON
  parse errors bubble); the global `errorHandler` maps everything to a single
  `{ success, message }` JSON shape. No `res.status(...).json(...)` for errors
  inside controllers.
- **Validation and pagination are middleware, not controller code** — the
  controller trusts that input is already validated and defaulted.
- **Persistence is mocked in tests** (no live Mongo required); a separate suite
  exercises the real auth middleware. See CONVENTIONS.md → Testing.

## Data models

- **User** — `username`, `email` (unique), `password` (hashed, `select:false`),
  `userType` (`admin` | `customer`). `comparePassword()` method.
- **Product** — `productName`, `url`, `price`, `description`, `createdBy` (User ref).

## API surface

`/api/auth` (register, login, me) · `/api/users` (list*, get, patch, delete) ·
`/api/products` (list*, create, get, patch, delete) · `/api/health`.
Endpoints marked `*` are paginated. Full contract: `GET /api-docs`.
