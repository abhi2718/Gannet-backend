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
