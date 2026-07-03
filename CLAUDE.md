# CLAUDE.md — Read this first

This file is loaded automatically. **Before writing or changing any code, follow
the workflow below.** It exists so that any future change is consistent with the
existing design instead of re-inventing it.

## STEP A — Before generating ANY module (read first, always)

Never write code before doing this. For every task:

1. **Read the architecture & all rules.** Open
   [`architecture/ARCHITECTURE.md`](architecture/ARCHITECTURE.md) (system design),
   [`architecture/FOLDER_STRUCTURE.md`](architecture/FOLDER_STRUCTURE.md) (where
   things live), and [`architecture/CONVENTIONS.md`](architecture/CONVENTIONS.md)
   (the protocols/rules). Understand the architecture, naming conventions, the
   route pattern, the ≤200-line rule, JWT/authorization, and mandatory pagination
   **before** touching source.
2. **Locate the right file.** Use `FOLDER_STRUCTURE.md`'s "Where do I change X?"
   map to find the most relevant existing file(s) — do not invent a new pattern
   when an existing one fits.
3. **Check history.** Skim [`architecture/HISTORY.md`](architecture/HISTORY.md)
   for past decisions and similar changes, and follow that precedent.

## STEP B — Definition of Done (a module is complete ONLY when all pass, in order)

After generating/changing a module, perform these steps **in this exact order**:

1. **Write the unit tests.** Cover **every possible condition and edge case** for
   the module (see the checklist below) — not just the happy path.
2. **Update the architecture docs.** Reflect any new route/field/convention/folder
   in `ARCHITECTURE.md` and `FOLDER_STRUCTURE.md` (skip only if the design is
   genuinely unchanged).
3. **Update `architecture/HISTORY.md`.** Add a new dated entry (use the template
   there) describing what changed, why, the tests, and any decisions.
4. **Run the checks:** `npm run lint` **and** `npm test` (also `npm run typecheck`).
5. **Verdict:** if lint and all unit tests pass → the module is **COMPLETE**. If
   anything fails → the module is **NOT complete**; fix and repeat from the failing
   step. Do not report a module as done until this passes.

### Edge-case checklist for unit tests (write every case that applies)

- **Happy path** — valid input → correct status + response body/shape.
- **Validation failures (400)** — each required field missing; wrong type/format
  (bad email, non-URL, negative number); empty update body; unknown/extra fields.
- **Auth (401)** — missing token, malformed `Authorization` header, invalid/expired
  token, token for a user that no longer exists.
- **Authorization (403)** — authenticated but wrong `userType` for a role-gated route.
- **Not found (404)** — valid id that doesn't exist; and **malformed id → 400**.
- **Conflict (409)** — duplicate unique field (e.g. existing email).
- **Pagination (list endpoints)** — defaults applied (page 1, size 20); custom
  `page`/`limit` produce correct `skip`/`limit` and `pagination` block; `limit`
  below the minimum (20) rejected with 400; boundary values.
- **Error shape** — failures return the standard `{ success: false, message }`.
- **Malformed JSON body → 400** where relevant.

## Non-negotiable rules (full detail in CONVENTIONS.md)

- **≤ 200 lines per file.** Enforced by ESLint (`max-lines`). Split before you exceed it.
- **No unused variables.** Enforced by ESLint + `tsc`.
- **Route pattern:** every route is a folder under `src/routes/<name>/` with
  exactly three files — `index.ts` (router + Swagger), `controller.ts`
  (handlers), `helpers.ts` (Joi schemas).
- **Auth:** protected routes use the `authenticate` JWT middleware; the JWT
  payload carries **only** the Mongo user id. Use `authorize(...)` for role gates.
- **Validation:** all input validated with Joi via the `validate` middleware.
- **Pagination is mandatory** for every list/`GET`-collection endpoint
  (default & minimum page size **20**). See the user/product list routes.
- **Definition of Done (per module):** generate → write unit tests for **every
  edge case** → update architecture docs → update history → run `lint` + `test`.
  A module is done **only** when lint and all tests pass (see STEP B above).

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start with hot reload |
| `npm test` | Run Jest unit tests |
| `npm run lint` | ESLint (also runs on pre-commit via Husky) |
| `npm run typecheck` | Type-check only |
| `npm run build` | Compile to `dist/` |

A Husky pre-commit hook runs `lint` + `test` and blocks the commit if either fails.
