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

- **User** — `username`, `email` (unique), `phoneNumber` (required, collected at
  registration), `password` (hashed, `select:false`), `userType`
  (`admin` | `customer`), `status` (`active` | `inactive`, default `active` —
  admins deactivate/reactivate). `comparePassword()` method. The admin user list
  derives `orderCount` (from Order) and `cities` (from Address) per user.
- **Address** — `street`, `pinCode`, `city` (all required strings), `landmark`
  (optional), `user` (owner ref). A user may own many addresses; an order
  references one. Owner-scoped CRUD (a customer manages only their own).
- **Product** — `productName`, `url`, `price`, `description`, `createdBy` (User ref).
- **Query** — `fullName`, `mobileNumber`, `email`, `city`, `requirement`,
  `message` (all required strings; `message` up to 2000 chars), `status`
  (enum `new` | `contacted` | `converted`, default `new`), plus `createdAt`
  (date of the enquiry, from timestamps). Public submission; admins can list
  (search/filter), edit, and delete.
- **Order** — `orderId` (auto, unique), `customerName`, `customerPhone`,
  `bottleSize`, `quantity`, `amount`, `estimatedDelivery` (Date, default +7d),
  `status` (enum: `pending` → `confirmed` → `out for delivery` → `delivered`, or
  `cancelled`; default `pending`), `user` (owner ref), `address` (Address ref;
  verified to belong to the caller on create). Customers see only their own
  orders; admins see all, and can edit/delete any order. `GET /api/orders/my`
  filters by name/phone/bottleSize (status, date range). The admin
  `GET /api/orders` uses an **aggregation pipeline** that `$lookup`s the user and
  address so a single `search` term matches the order's customer name/phone OR
  the user's name/email/phone OR any part of the address (see "Cross-collection
  search" below).

## API surface

`/api/auth` (register, login, me) ·
`/api/users` (list*[admin, search+status-filter], get, patch, delete) ·
`/api/products` (list*, create, get, patch, delete) ·
`/api/queries` (**POST public+rate-limited**, list*+single-term-search+status-filter/edit/delete admin) ·
`/api/addresses` (list*[own], create, get, patch, delete — owner-scoped) ·
`/api/orders` (my-list*, all-list*[admin], create, get, edit[admin],
patch-status[admin], delete[admin]; lists searchable+filterable) ·
`/api/analytics` (**admin only**: order-status counts, platform summary,
monthly bookings/queries trends — for dashboards & charts) ·
`/api/health`. Endpoints marked `*` are paginated. Full contract: `GET /api-docs`.

## Cross-collection search (admin lists)

Two admin lists must search/display by fields that live on *other* collections,
so both are built as **aggregation pipelines** rather than `find` + `populate`
(Mongoose `populate` cannot filter parent documents by a joined child's fields —
it only nulls the child — which would break pagination totals):

- **`GET /api/orders` (admin)** — `$lookup` + `$unwind` the `user` and `address`,
  then `$match` a search `$or` across the order's customer name/phone, the user's
  name/email/phone, and the address fields. Builder: `buildAdminOrderPipeline`
  in `routes/order/helpers.ts`.
- **`GET /api/users` (admin)** — `$lookup` the user's `orders` and `addresses`,
  `$addFields` `orderCount` (`$size`) and distinct `cities`, then `$match` a
  search `$or` across name/email/phone/city (and the exact `orderCount` when the
  term is an integer). A `$project` drops the `password` hash and the raw joined
  arrays (aggregation bypasses the model's `select:false`). Builder:
  `buildUserListPipeline` in `routes/user/helpers.ts`.

Both apply their non-joined filters (`status`, date) in an initial `$match`,
regex-escape user input (CONVENTIONS §10a), and end with a `$facet` returning the
page of `data` plus `totalCount` so `find`/`count` totals stay consistent.

## Analytics (admin dashboards & charts)

`src/routes/analytics/` exposes three **admin-only** read endpoints
(`authenticate → authorize(ADMIN)` on the whole router) for dashboards; none are
paginated (they return small fixed shapes):

- **`GET /api/analytics/order-status`** — `$group` orders by `status` → a map of
  every `OrderStatus` to its count (absent statuses reported as 0).
- **`GET /api/analytics/summary`** — `totalOrders`, `pendingOrders`,
  `deliveredOrders` (completed) and `totalUsers` via parallel `countDocuments`.
- **`GET /api/analytics/monthly-trends`** — a **dense** month series for charting:
  a shared `months` axis (`[1..currentMonth]` for the current year, `[1..12]` for a
  past year) plus `bookings` (Order) and `queries` (Query) **count arrays aligned
  to it**, zero-filled for months with no data, plus the resolved `year`. Optional
  `year` query param (default: current year).

Pipeline builders and the trends query schema live in `analytics/helpers.ts`.

## Owner-scoped access

Some resources are scoped to their owner. Orders expose **two explicit list
endpoints**: `GET /api/orders/my` returns only the caller's own orders (filter
`{ user: id }`, any authenticated user); `GET /api/orders` returns **all** orders
and is **admin-only** (`authorize(ADMIN)`, filter `{}`). Both are paginated. A
customer fetching another user's order via `GET /api/orders/:id` gets 403.

## Public vs protected endpoints

Most routes require a JWT. Exceptions (`security: []`): `POST /api/auth/register`,
`POST /api/auth/login`, `GET /api/health`, and **`POST /api/queries`** — the
public enquiry form. Public write endpoints must be rate-limited; `POST
/api/queries` uses a dedicated strict `queryRateLimiter` (5/hour per IP).
