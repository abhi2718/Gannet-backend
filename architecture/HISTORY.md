# Change History

Append-only log of every meaningful change, **newest first**. Future work should
skim this for precedent before making similar changes.

**How to add an entry** (copy the template to the top, under this line):

```
## YYYY-MM-DD — <short title>
- **What:** <what changed, which files>
- **Why:** <reason / trigger>
- **Tests:** <tests added/updated + result>
- **Notes:** <decisions, trade-offs, follow-ups>
```

---

## 2026-07-04 — Users: admin-only list + active/inactive status + cross-collection search
- **What:** (1) Added `UserStatus` enum (`active` | `inactive`, default `active`,
  indexed) + `status` field to `models/user.model.ts`; added `status` and
  `phoneNumber` to `updateUserSchema` so admins can deactivate/edit a user.
  (2) Gated `GET /api/users` with `authorize(ADMIN)`. (3) Rebuilt the list as an
  aggregation (`buildUserListPipeline` in `routes/user/helpers.ts`) that
  `$lookup`s each user's orders + addresses, `$addFields` `orderCount` (`$size`)
  and distinct `cities`, `$match`es a single `search` term ($or over username/
  email/phoneNumber/cities, plus exact `orderCount` when the term is an integer),
  filters by `status`, `$project`s out the password hash + raw joined arrays, and
  `$facet`s data + total. List query schema gained `search` + `status`.
- **Why:** User request — only admins may list users; search by name/email/phone/
  city/order-count, filter by active/inactive, and show name/email/phone/city/
  join date/orders/status per user.
- **Tests:** `tests/user.test.ts` — rewrote the list suite for aggregation
  (defaults + custom page/limit, `limit<20` → 400); order+address `$lookup`s
  present; search `$or` fields; numeric term adds `orderCount`, non-numeric
  doesn't; status filter in the pre-join `$match`; invalid status → 400;
  `password:0` projection; non-admin → 403. Added status-edit + invalid-status
  cases to PATCH. 164 tests pass.
- **Notes:** Second cross-collection aggregation list (after admin orders);
  documented under ARCHITECTURE "Cross-collection search". The `$project
  { password: 0 }` is mandatory because aggregation bypasses the model's
  `select:false`.

## 2026-07-04 — Add Address module + order.address + required phoneNumber + admin order join-search
- **What:** (1) New `Address` model (`street`/`pinCode`/`city` required,
  `landmark` optional, `user` owner ref; many addresses per user) + owner-scoped
  CRUD route `routes/address/*` mounted at `/api/addresses` (list own*/create/
  get/patch/delete; get/patch/delete enforce owner-or-admin). (2) Added required
  `phoneNumber` to `models/user.model.ts` + `registerSchema` + the register
  controller + Swagger. (3) Added required `address` ref to
  `models/order.model.ts`; `createOrder` verifies the address exists and belongs
  to the caller (else 400); `/my` populates the address. (4) Rebuilt admin
  `GET /api/orders` as an aggregation (`buildAdminOrderPipeline`) that `$lookup`s
  user + address so a `search` term matches the order's customer name/phone OR the
  user's name/email/phone OR any address field. Moved `escapeRegex` +
  `buildOrderFilter` into `routes/order/helpers.ts`.
- **Why:** User request — model addresses (many per user), connect an address to
  each order, collect a phone number at registration, and let admins search
  orders by person name/email/phone/address and filter by status.
- **Tests:** New `tests/address.test.ts` (CRUD, pagination, ownership 403, 404,
  malformed id, validation, malformed JSON). `tests/order.test.ts` — `address`
  added to validBody + required matrix; malformed/unowned address → 400; admin
  list rewritten to assert the aggregation pipeline (user/address `$lookup`s,
  search `$or`, status pre-`$match`, facet skip/limit, regex escaping).
  `tests/auth.test.ts` — phoneNumber required/invalid + added to the duplicate
  body. Added address routes to `protected-routes.test.ts` (401).
- **Notes:** First use of aggregation for cross-collection search — Mongoose
  `populate` can't filter parent docs by a joined child's fields without breaking
  pagination totals. Order & address refs are verified for ownership on create.

## 2026-07-04 — Orders: search/filter + admin edit/delete + status enum
- **What:** (1) Expanded `OrderStatus` to `pending` (new default) | `confirmed` |
  `out for delivery` | `delivered` | `cancelled`. (2) Replaced generic `itemName`
  with domain fields `customerName`, `customerPhone`, `bottleSize` (all required,
  indexed) so orders are searchable. (3) Both list endpoints now accept a single
  `search` term ($or over customerName/customerPhone/bottleSize, regex-escaped),
  a `status` filter, and a `dateFrom`/`dateTo` range on `createdAt` — merged with
  the ownership base filter in `respondWithPaginatedOrders`. (4) New admin
  endpoints: `PATCH /api/orders/:id` (full edit, `updateOrderSchema`, min 1) and
  `DELETE /api/orders/:id`. Kept `PATCH /api/orders/:id/status`.
- **Why:** User request — search orders by customer name/phone/bottle size, filter
  by date and status (incl. cancelled), and let admins review/edit and delete.
- **Tests:** `tests/order.test.ts` — new fields in validBody + required matrix;
  default status `pending`; `/my` and admin `/` search build ($or + status +
  date range) + invalid status → 400; PATCH `/:id` edit success/empty-body/
  invalid-status/404/bad-id/non-admin-403; DELETE `/:id` success/404/bad-id/
  non-admin-403. Added PATCH+DELETE `/api/orders/:id` → 401 to protected-routes.
- **Notes:** `bottleSize` replaces `itemName` (domain rename). Search follows the
  type-ahead $or convention (CONVENTIONS §10a). `index.ts` exceeds 200 raw lines
  but is mostly @openapi comments (max-lines skips comments/blanks).

## 2026-07-04 — Orders: split into explicit /my and admin-all endpoints
- **What:** Replaced the single role-branching `GET /api/orders` with two
  explicit endpoints: `GET /api/orders/my` (any authed user → own orders,
  `listMyOrders`, filter `{ user: id }`) and `GET /api/orders` (admin-only →
  all orders, `listAllOrders`, filter `{}`). Extracted a shared
  `respondWithPaginatedOrders(filter, req, res)` helper in the controller.
  `/my` is registered before `/:id` so it isn't captured as an id.
- **Why:** User request — a user must access only his own orders (paginated) and
  never another user's; admins access all orders (paginated). Two explicit APIs.
- **Tests:** `tests/order.test.ts` — rewrote list tests: `/my` returns own
  filter (customer and admin scoped to self); `limit<20` → 400; admin `/` lists
  all with pagination; **customer `/` → 403**; admin `/?limit=5` → 400. Added
  `GET /api/orders/my` → 401 to `protected-routes.test.ts`.
- **Notes:** `GET /api/orders/:id` still enforces ownership (own or admin → 200,
  else 403).

## 2026-07-04 — Add Order module (owner-scoped + admin status)
- **What:** New `order` resource. `models/order.model.ts` (`orderId` auto/unique,
  `itemName`, `quantity`, `amount`, `estimatedDelivery` default +7d, `status`
  enum `order placed|confirmed|out for delivery|delivered` default `order
  placed`, `user` owner ref) + `OrderStatus` enum;
  `routes/order/{helpers,controller,index}.ts`; mounted at `/api/orders`.
  Endpoints: `POST /` (create for current user), `GET /` (paginated — customer
  sees own via `{user:id}` filter, admin sees all `{}`), `GET /:id` (own or
  admin, else 403), `PATCH /:id/status` (admin-only status transition).
- **Why:** User request — orders with lifecycle status; each user sees only their
  own orders (paginated), admins see all.
- **Tests:** `tests/order.test.ts` — create success + user id + default status;
  each required field missing → 400; quantity<1, negative amount, bad date → 400;
  customer sees own (`find({user})`) vs admin sees all (`find({})`); pagination
  defaults + custom + `limit<20` → 400; get own 200 / other's 403 / admin 200 /
  404 / bad-id 400; status update admin 200 / invalid value 400 / 404 /
  non-admin 403. Added order endpoints to `protected-routes.test.ts` (401).
- **Notes:** Established the **owner-scoped access** pattern (branch on
  `req.user.userType`; customers filtered to `{ user: id }`). `item` and
  `itemName` collapsed to a single `itemName` field. `orderId` is a generated
  business id distinct from Mongo `_id`.

## 2026-07-04 — Query: single-term ($or) search for type-ahead
- **What:** Replaced the four separate search params (name/mobile/email/city)
  on `GET /api/queries` with a single `search` param that matches (case-
  insensitively, regex-escaped) against ANY of fullName/mobileNumber/email/city
  via `$or`. `status` filter unchanged. Updated `buildQueryFilter`, the list
  query schema, and Swagger.
- **Why:** User request — one search box; typing anything should match name OR
  mobile OR email OR city (client calls the API on each keystroke).
- **Tests:** `tests/query.test.ts` — search builds a 4-way `$or`; search+status
  combine; regex metachars escaped; invalid status → 400.
- **Notes:** Extended CONVENTIONS §10a with the type-ahead single-search pattern.

## 2026-07-04 — Query: status + admin edit/delete + search/filter
- **What:** Added `QueryStatus` enum (`new` | `contacted` | `converted`, default
  `new`, indexed) + `status` field to `models/query.model.ts` (date of query =
  `createdAt` from timestamps). New admin endpoints: `PATCH /api/queries/:id`
  (edit any fields + status, `updateQuerySchema`, min 1) and
  `DELETE /api/queries/:id`. `GET /api/queries` now supports search
  (partial, case-insensitive on name/mobile/email/city) and `status` filter via
  `buildQueryFilter` in the controller (regex-escaped). Added `queryIdParamSchema`.
- **Why:** User request — track enquiry lifecycle, let admins manage (edit/
  delete) enquiries, and search/filter them.
- **Tests:** `tests/query.test.ts` — search filter build + regex escaping +
  invalid status → 400; PATCH update/invalid status/empty body/404/bad-id;
  DELETE success/404/bad-id. Added PATCH+DELETE `/api/queries/:id` → 401 to
  `protected-routes.test.ts`. Fixed both query test mocks to keep `QueryStatus`
  (helpers now imports it) via `requireActual`.
- **Notes:** Established the **search & filtering** convention (CONVENTIONS §10a):
  validated query params + escaped regex + shared filter for find/count.

## 2026-07-04 — Query: add required `message` field
- **What:** Added `message` (required string, max 2000) to the Query model
  (interface + schema) and to `createQuerySchema` (Joi). Aligned Joi `requirement`
  max to the model (120). Updated Swagger required/properties and the Query model
  entry in `ARCHITECTURE.md`.
- **Why:** User request — enquiries must include a message body (max 2000 chars).
- **Tests:** `tests/query.test.ts` — added `message` to `validBody` and to the
  required-field matrix, plus a `message > 2000 chars → 400` boundary test;
  updated `query-ratelimit.test.ts` body. Result below.
- **Notes:** Kept `requirement` at 120 to match the model (the schema value the
  user set); flagged for confirmation.

## 2026-07-04 — Add public Query (enquiry) module
- **What:** New `query` resource. `models/query.model.ts` (fullName,
  mobileNumber, email, city, requirement — all required strings);
  `routes/query/{helpers,controller,index}.ts`; mounted at `/api/queries` in
  `routes/index.ts`. `POST /api/queries` is **public (no auth)** and rate-limited;
  `GET /api/queries` is admin-only + paginated. Added `queryRateLimiter`
  (5 submissions/hour per IP) to `middlewares/rateLimiter.ts`.
- **Why:** Website visitors submit enquiries via a popup form without logging in;
  needs spam protection via rate limiting.
- **Tests:** `tests/query.test.ts` (public POST success without token; each of
  the 5 required fields missing → 400; invalid email; invalid mobile; unknown
  fields stripped; malformed JSON → 400; admin list pagination defaults, custom
  page/limit, `limit<20` → 400) and `tests/query-ratelimit.test.ts` (real
  limiter: 5×201 then 429 + message). Added `GET /api/queries` → 401 to
  `tests/protected-routes.test.ts`. Result below.
- **Notes:** Followed the standard route pattern + pagination convention.
  Rate-limit suite lives in its own file so the real singleton limiter is
  isolated; the functional suite mocks `rateLimiter` to a passthrough.

## 2026-07-04 — Codify Definition of Done + edge-case testing
- **What:** Rewrote the workflow in `CLAUDE.md` into two explicit phases —
  STEP A (read architecture + all rules before generating any module) and STEP B
  (ordered Definition of Done: write unit tests → update architecture → update
  history → run lint + test → verdict). Added an edge-case checklist. Aligned
  `CONVENTIONS.md` §9 to the same order and edge-case requirements.
- **Why:** User directive — enforce reading the architecture first, and make a
  module "complete" only after tests (covering every edge case), doc + history
  updates, and passing lint/test, in that exact order.
- **Tests:** Docs-only; no source changed. `npm test` still green (40 tests).
- **Notes:** Edge-case checklist covers happy path, 400/401/403/404/409,
  pagination bounds, error shape, and malformed JSON.

## 2026-07-04 — Add architecture documentation system
- **What:** Added `CLAUDE.md` (read-first workflow) and the `architecture/`
  folder: `ARCHITECTURE.md`, `FOLDER_STRUCTURE.md`, `CONVENTIONS.md`, and this
  `HISTORY.md`.
- **Why:** Establish a durable, self-describing structure so future changes
  locate the right file fast and follow existing patterns (route pattern, ≤200
  lines, JWT auth, mandatory pagination, test-after-module).
- **Tests:** Docs-only; no code changed. `npm test` still green (40 tests).
- **Notes:** `CLAUDE.md` is auto-loaded by Claude Code and is the enforcement
  entry point. Every future change must end by updating this file.

## 2026-07-04 — Pagination for products + tests
- **What:** Added `listProductsQuerySchema` to `routes/product/helpers.ts`;
  paginated `listProducts` in `routes/product/controller.ts`; wired
  `validate(..., 'query')` and Swagger params in `routes/product/index.ts`.
- **Why:** Consistency with the user list endpoint; pagination is mandatory for
  collection GETs.
- **Tests:** `tests/product.test.ts` — replaced the plain list test with a
  pagination suite (defaults, custom page/limit, `limit<20` → 400). 40 tests pass.
- **Notes:** Mirrors the user pagination pattern exactly (page size default/min 20, max 100).

## 2026-07-03 — Unit tests for user & product APIs
- **What:** Added `tests/user.test.ts`, `tests/product.test.ts`,
  `tests/protected-routes.test.ts`, and `tests/helpers/mockQuery.ts`.
- **Why:** Cover all APIs, not just auth.
- **Tests:** 38 tests total, all passing.
- **Notes:** Chose mocked persistence (network too unreliable to install
  `mongodb-memory-server`). Auth middleware mocked for route-logic tests; a
  separate suite exercises the real JWT guard (401s). Follow-up: real DB
  integration tests if a stable environment becomes available.

## 2026-07-03 — Pagination for users
- **What:** Added `listUsersQuerySchema` to `routes/user/helpers.ts`; paginated
  `listUsers` in `routes/user/controller.ts`; wired query validation + Swagger.
- **Why:** Requirement — list endpoints must paginate with page size ≥ 20.
- **Tests:** Covered later by `tests/user.test.ts`.
- **Notes:** Established the pagination convention (see CONVENTIONS.md §6).

## 2026-07-03 — Husky pre-commit hook (lint + test)
- **What:** `git init`; installed `husky`; added `prepare` script and
  `.husky/pre-commit` running `npm run lint` then `npm test`.
- **Why:** Prevent commits that fail lint or tests.
- **Tests:** Verified by making the initial commit (hook ran, passed).
- **Notes:** Bypass with `git commit --no-verify` in emergencies only.

## 2026-07-03 — Fix malformed-JSON error + auth tests
- **What:** `middlewares/errorHandler.ts` now maps body-parser JSON
  `SyntaxError` to a clean 400 (`Invalid JSON payload in request body`). Added
  `tests/auth.test.ts` and Jest/ts-jest/supertest tooling.
- **Why:** Malformed request bodies produced an ugly 500 with a raw parser stack.
- **Tests:** 6 auth tests (login/register validation, duplicate email, JSON error).
- **Notes:** Removed stray debug `console.log`s from `validate.ts` and the login controller.

## 2026-07-03 — Fix req.user typing under ts-node
- **What:** Added `"ts-node": { "files": true }` to `tsconfig.json`.
- **Why:** `ts-node` didn't load the ambient `types/express.d.ts` augmentation,
  so `req.user` failed to type-check at dev runtime (worked under `tsc`).
- **Tests:** Verified `ts-node` compiles `auth.ts` cleanly.
- **Notes:** —

## 2026-07-03 — Initial scaffold
- **What:** Full project: Express+Mongo+TS app under `src/` with config, models
  (User, Product), middlewares (auth, validate, rateLimiter, notFound,
  errorHandler), utils (ApiError, catchAsync, jwt), and auth/user/product routes
  (each `index`/`controller`/`helpers`). Swagger, ESLint flat config
  (max-lines 200, no-unused-vars), `.env`/`.env.example`, README.
- **Why:** Project kickoff.
- **Tests:** Boot smoke test (health 200, unknown 404, protected 401).
- **Notes:** Established the route pattern, JWT-holds-only-user-id, centralised
  errors, and the ≤200-line rule.
