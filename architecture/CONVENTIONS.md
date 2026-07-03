# Conventions & Rules

These are enforced (by ESLint/tsc/Husky) or required-by-convention. Follow them
strictly; if a change needs to break one, record the reason in `HISTORY.md`.

## 1. File size — ≤ 200 lines

Every file must be **≤ 200 lines** (`max-lines`, skips blanks/comments). If a
controller or module grows past it, split by responsibility (e.g. extract a
`helpers.ts`, a `service`, or split routes) rather than shrinking formatting.

## 2. No unused variables

`@typescript-eslint/no-unused-vars` + `tsc` `noUnusedLocals`/`noUnusedParameters`.
Prefix an intentionally-unused parameter with `_` (e.g. `_req`, `_next`).

## 3. Route pattern (mandatory)

Every resource is a folder `src/routes/<entity>/` with **exactly three files**:

- **`index.ts`** — creates the `Router`, applies middleware in order, and holds
  the `@openapi` JSDoc for Swagger. Middleware order:
  `authenticate → authorize(...) (if role-gated) → validate(schema[, part]) → controller`.
- **`controller.ts`** — request handlers only. Each handler is wrapped in
  `catchAsync`. Throw `ApiError.*` for failures; never build error JSON here.
  Success shape: `{ success: true, data }` (+ `count`/`pagination` for lists).
- **`helpers.ts`** — Joi schemas and route-local pure helpers only.

Mount the new router in `src/routes/index.ts`.

## 4. Auth & authorization

- Protected routes call `authenticate` (per-route or `router.use(authenticate)`).
- `authenticate` verifies the Bearer JWT, loads the user by `sub` (Mongo id),
  and sets `req.user`.
- Role-restricted actions add `authorize(UserType.ADMIN, ...)` after `authenticate`.
- **JWT payload = `{ sub: <userId> }` only.** Never embed email/role/etc.

## 5. Validation

- All external input (`body`, `params`, `query`) is validated with Joi through
  the `validate(schema, part)` middleware — never hand-roll checks in controllers.
- `validate` strips unknown keys and replaces the request part with the
  sanitised value.

## 6. Pagination (mandatory for list/GET-collection endpoints)

Any endpoint returning a collection **must** paginate. Standard pattern:

```ts
// helpers.ts
export const DEFAULT_PAGE_SIZE = 20;
export const list<Entity>QuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(DEFAULT_PAGE_SIZE).max(100)
    .default(DEFAULT_PAGE_SIZE),
});
```

```ts
// controller.ts
const page = Number(req.query.page);
const limit = Number(req.query.limit);
const skip = (page - 1) * limit;
const [items, total] = await Promise.all([
  Model.find().sort({ createdAt: -1 }).skip(skip).limit(limit),
  Model.countDocuments(),
]);
res.status(200).json({
  success: true,
  count: items.length,
  pagination: { total, page, limit, totalPages: Math.ceil(total / limit),
    hasNextPage: page * limit < total, hasPrevPage: page > 1 },
  data: items,
});
```

- Default **and minimum** page size is **20**; max 100. Wire the query schema in
  `index.ts` via `validate(list<Entity>QuerySchema, 'query')`.

## 7. Errors

- Throw `ApiError.badRequest/unauthorized/forbidden/notFound/conflict(...)`.
- The global `errorHandler` is the only place that formats error responses and
  is registered **last** in `app.ts` (after routes and `notFound`).

## 8. Config

- Read env only through `src/config/env.ts`. New vars: add to its Joi schema and
  to both `.env.example` and `.env`.

## 9. Definition of Done (per module — required, in this order)

Before starting: read `ARCHITECTURE.md`, `FOLDER_STRUCTURE.md`, this file, and
skim `HISTORY.md`. Then, for every new/changed module:

1. **Generate/modify** the module following the conventions above.
2. **Write unit tests** under `tests/<area>.test.ts` covering **every possible
   condition and edge case** — not only the happy path:
   - Mock persistence: mock the model(s); use `tests/helpers/mockQuery.ts` for
     chainable query mocks. Mock `../src/middlewares/auth` to bypass JWT for
     route-logic tests; assert the real guard separately (see
     `protected-routes.test.ts`).
   - Required edge cases (write each that applies): happy path; every validation
     failure (400) — missing required fields, wrong type/format, empty update
     body, unknown fields; auth (401) — missing/malformed/invalid/expired token,
     user no longer exists; authorization (403) — wrong `userType`; not-found
     (404) and malformed id (400); conflict (409) — duplicate unique field;
     pagination — defaults, custom `page`/`limit`, `limit < 20` → 400, boundaries;
     standard error shape `{ success:false, message }`; malformed JSON → 400.
3. **Update the architecture docs** (`ARCHITECTURE.md`, `FOLDER_STRUCTURE.md`) if
   the design changed.
4. **Update `architecture/HISTORY.md`** with a dated entry.
5. **Run `npm run lint` and `npm test`** (also `npm run typecheck`).
6. **Verdict:** COMPLETE only if lint + all tests pass; otherwise NOT complete —
   fix and repeat from the failing step.

## 10. Documentation

- Every route gets an `@openapi` JSDoc block in its `index.ts`.
- If the design changes (new folder, layer, or convention), update
  `ARCHITECTURE.md` / `FOLDER_STRUCTURE.md` in the same change.
