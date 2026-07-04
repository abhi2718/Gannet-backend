# Gannet API Reference

Complete reference for the Gannet REST API — every endpoint, its authentication,
request payload (with validation rules), success response, and every failure/error
it can return.

- **Base URL:** all routes are mounted under `/api` (e.g. `http://localhost:5000/api`).
- **Content type:** requests and responses are JSON (`Content-Type: application/json`).
  The JSON body is capped at **10 kb**.
- **Interactive docs:** a live Swagger UI is served at **`GET /api-docs`**.
- **Coverage:** every endpoint below is exercised by the Jest suite under
  [`tests/`](tests/), and this document is itself verified by
  [`tests/api-docs.test.ts`](tests/api-docs.test.ts) (every mounted route must
  appear here).

---

## Conventions

### Success shape

Every successful response is:

```json
{ "success": true, "data": <object | array | null> }
```

List endpoints add `count` (items on this page) and a `pagination` block:

```json
{
  "success": true,
  "count": 20,
  "pagination": {
    "total": 42, "page": 1, "limit": 20,
    "totalPages": 3, "hasNextPage": true, "hasPrevPage": false
  },
  "data": [ /* … */ ]
}
```

### Error shape

Every error (any 4xx/5xx) is normalised by the global error handler to:

```json
{ "success": false, "message": "<human-readable reason>" }
```

Outside production a `stack` field is also included to aid debugging.

### Status codes

| Code | Meaning | Typical trigger |
| --- | --- | --- |
| `200` | OK | Successful read/update/delete |
| `201` | Created | Successful create |
| `400` | Bad Request | Validation failed, malformed id, or malformed JSON body |
| `401` | Unauthorized | Missing / malformed / invalid / expired token, or the token's user no longer exists |
| `403` | Forbidden | Authenticated but lacking the role, or accessing another user's resource |
| `404` | Not Found | Valid id that doesn't exist |
| `409` | Conflict | Duplicate unique value (e.g. email already registered) |
| `429` | Too Many Requests | Rate limit exceeded |
| `500` | Internal Server Error | Unexpected/unhandled error |

Two special 400s worth noting:

- **Malformed JSON body** → `{ "success": false, "message": "Invalid JSON payload in request body" }`.
- **Malformed id** in a path (not 24 hex chars) → `{ "success": false, "message": "Invalid id" }`.

### Authentication

Protected endpoints require a **Bearer JWT**:

```
Authorization: Bearer <token>
```

- Obtain a token from `POST /api/auth/register` or `POST /api/auth/login`.
- The JWT payload carries **only** the Mongo user id (`sub`); the server re-loads
  the user on every request, so a deleted/changed user takes effect immediately.
- Default expiry is `1d` (configurable via `JWT_EXPIRES_IN`).

Missing/invalid tokens return **401** with one of:
`Missing or malformed Bearer token`, `Invalid or expired token`, or
`User for this token no longer exists`.

Role-gated (admin-only) endpoints additionally return **403**
`Insufficient permissions` when the caller is authenticated but not an admin.

### Rate limiting

| Scope | Limit | Applies to |
| --- | --- | --- |
| Global | `RATE_LIMIT_MAX` per `RATE_LIMIT_WINDOW_MS` (default **100 / 15 min**) | every request |
| Auth | max(5, global/10) (default **10** / window) | `POST /api/auth/register`, `POST /api/auth/login` |
| Public query | **5 / hour per IP** | `POST /api/queries` |

Exceeding a limit returns **429** with a `{ success:false, message }` body.

### Pagination (list endpoints)

| Param | Type | Default | Rules |
| --- | --- | --- | --- |
| `page` | integer | `1` | `>= 1` |
| `limit` | integer | `20` | `>= 20` and `<= 100` (a value below 20 → **400**) |

### Roles

`userType` is `admin` or `customer` (default `customer`). "Owner-scoped"
endpoints let a customer act only on their own records; an admin may access any.

---

## Data models

**User** — `username`, `email` (unique), `phoneNumber`, `userType`
(`admin`|`customer`), `status` (`active`|`inactive`), timestamps. `password` is
write-only and never returned.

**Address** — `label`, `street`, `pinCode`, `city`, `state` (required),
`landmark` (optional), `user` (owner ref), timestamps.

**Order** — `orderId` (auto, unique), `customerName`, `customerPhone`,
`bottleSize`, `quantity`, `amount`, `estimatedDelivery`, `status`
(`pending`|`confirmed`|`out for delivery`|`delivered`|`cancelled`, default
`pending`), `user` (owner ref), `address` (ref), timestamps.

**Product** — `productName`, `url`, `price`, `description`, `createdBy` (ref).

**Query** (enquiry) — `fullName`, `mobileNumber`, `email`, `city`, `requirement`,
`message`, `status` (`new`|`contacted`|`converted`, default `new`), timestamps.

---

## Auth  `/api/auth`

### `POST /api/auth/register` — Register

**Auth:** public. **Rate limit:** auth.

Request body:

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `username` | string | yes | 3–50 chars |
| `email` | string | yes | valid email, lower-cased, unique |
| `phoneNumber` | string | yes | `^\+?[0-9\s\-()]{7,20}$` |
| `password` | string | yes | 6–128 chars |
| `userType` | string | no | `admin` or `customer` (default `customer`) |

```json
{ "username": "jane", "email": "jane@example.com", "phoneNumber": "+12025550123", "password": "secret123" }
```

**201** → `{ "success": true, "data": { "user": { … }, "token": "<jwt>" } }`

Errors: **400** (missing/invalid field), **409** `Email is already registered`,
**429** (rate limit).

### `POST /api/auth/login` — Log in

**Auth:** public. **Rate limit:** auth.

Request body:

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `email` | string | yes | valid email |
| `password` | string | yes | 6–128 chars |

**200** → `{ "success": true, "data": { "user": { … }, "token": "<jwt>" } }`

Errors: **400** (missing field), **401** `Invalid email or password`, **429**.

### `GET /api/auth/me` — Current user

**Auth:** required.

**200** → `{ "success": true, "data": { "user": { … } } }`

Errors: **401**.

---

## Users  `/api/users`

### `GET /api/users` — List users (admin)

**Auth:** admin only. Aggregation list — each row includes `orderCount` (from
Orders), `cities` (distinct, from Addresses), join date (`createdAt`) and
`status`; the `password` hash is never returned.

Query params: `page`, `limit` (see [Pagination](#pagination-list-endpoints)) plus:

| Param | Type | Notes |
| --- | --- | --- |
| `search` | string (≤120) | matches name OR email OR phone OR any city; an **integer** term also matches the exact order count |
| `status` | enum | `active` or `inactive` |

**200** → paginated list. Errors: **400** (bad `limit`/`status`), **401**, **403**.

### `GET /api/users/:id` — Get a user

**Auth:** required. **200** → `{ success, data: <user> }`.
Errors: **400** (malformed id), **401**, **404** `User not found`.

### `PATCH /api/users/:id` — Update a user

**Auth:** required. Body — **at least one** of:

| Field | Type | Rules |
| --- | --- | --- |
| `username` | string | 3–50 |
| `email` | string | valid email |
| `phoneNumber` | string | phone pattern |
| `userType` | string | `admin`\|`customer` |
| `status` | string | `active`\|`inactive` |

**200** → updated user. Errors: **400** (empty body / invalid field / bad id),
**401**, **404**.

### `DELETE /api/users/:id` — Delete a user (admin)

**Auth:** admin only. **200** → `{ success, data: null }`.
Errors: **400**, **401**, **403**, **404**.

---

## Products  `/api/products`

All product endpoints require authentication.

### `GET /api/products` — List products

Query params: `page`, `limit`. **200** → paginated list. Errors: **400**, **401**.

### `POST /api/products` — Create a product

Body:

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `productName` | string | yes | ≤120 |
| `url` | string | yes | valid URI |
| `price` | number | yes | ≥ 0 |
| `description` | string | yes | ≤2000 |

**201** → created product. Errors: **400**, **401**.

### `GET /api/products/:id` — Get a product

**200** → product. Errors: **400** (bad id), **401**, **404** `Product not found`.

### `PATCH /api/products/:id` — Update a product

Body — at least one of `productName`, `url`, `price`, `description`.
**200** → updated product. Errors: **400**, **401**, **404**.

### `DELETE /api/products/:id` — Delete a product

**200** → `{ success, data: null }`. Errors: **400**, **401**, **404**.

---

## Queries (enquiries)  `/api/queries`

### `POST /api/queries` — Submit an enquiry (public)

**Auth:** public. **Rate limit:** 5 / hour per IP.

Body:

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `fullName` | string | yes | 2–120 |
| `mobileNumber` | string | yes | phone pattern |
| `email` | string | yes | valid email |
| `city` | string | yes | 2–120 |
| `requirement` | string | yes | 3–120 |
| `message` | string | yes | 3–2000 |

**201** → created query. Errors: **400**, **429** `Too many query submissions…`.

### `GET /api/queries` — List enquiries (admin)

**Auth:** admin only. Query params: `page`, `limit`, plus:

| Param | Type | Notes |
| --- | --- | --- |
| `search` | string (≤120) | matches name OR mobile OR email OR city |
| `status` | enum | `new`\|`contacted`\|`converted` |

**200** → paginated list. Errors: **400**, **401**, **403**.

### `PATCH /api/queries/:id` — Edit / set status (admin)

**Auth:** admin only. Body — at least one of `fullName`, `mobileNumber`,
`email`, `city`, `requirement`, `message`, `status`.
**200** → updated query. Errors: **400**, **401**, **403**, **404**.

### `DELETE /api/queries/:id` — Delete an enquiry (admin)

**Auth:** admin only. **200** → `{ success, data: null }`.
Errors: **400**, **401**, **403**, **404**.

---

## Addresses  `/api/addresses`

Owner-scoped: a customer manages only their own addresses (an admin may read any
single address). All endpoints require authentication.

### `GET /api/addresses` — List my addresses

Query params: `page`, `limit`. Returns only the **caller's** addresses.
**200** → paginated list. Errors: **400**, **401**.

### `POST /api/addresses` — Create an address

Body:

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `label` | string | yes | 1–50 (e.g. home / office / student) |
| `street` | string | yes | 2–200 |
| `pinCode` | string | yes | 3–20 |
| `city` | string | yes | 2–100 |
| `state` | string | yes | 2–100 |
| `landmark` | string | no | ≤200 |

```json
{ "label": "home", "street": "221B Baker Street", "pinCode": "110011", "city": "London", "state": "Greater London" }
```

**201** → created address (with `user` set to the caller). Errors: **400**, **401**.

### `GET /api/addresses/:id` — Get an address

**Auth:** owner or admin. **200** → address.
Errors: **400** (bad id), **401**, **403** `You can only access your own addresses`,
**404** `Address not found`.

### `PATCH /api/addresses/:id` — Update an address

**Auth:** owner or admin. Body — at least one of `label`, `street`, `pinCode`,
`city`, `state`, `landmark`. **200** → updated address.
Errors: **400** (empty body / bad id), **401**, **403**, **404**.

### `DELETE /api/addresses/:id` — Delete an address

**Auth:** owner or admin. **200** → `{ success, data: null }`.
Errors: **400**, **401**, **403**, **404**.

---

## Orders  `/api/orders`

All endpoints require authentication. Customers see only their own orders;
admins see and manage all.

### `POST /api/orders` — Create an order

**Auth:** required. The `address` must be one of the **caller's own** addresses.

Body:

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `customerName` | string | yes | 2–120 |
| `customerPhone` | string | yes | phone pattern |
| `bottleSize` | string | yes | 1–60 |
| `quantity` | integer | yes | ≥ 1 |
| `amount` | number | yes | ≥ 0 |
| `address` | string (id) | yes | 24-hex id of one of the caller's addresses |
| `estimatedDelivery` | string (ISO date) | no | defaults to now + 7 days |

**201** → created order (owned by the caller, `status: "pending"`).
Errors: **400** (validation, or `address not found or does not belong to you`), **401**.

### `GET /api/orders` — List all orders (admin)

**Auth:** admin only. Aggregation search that joins the user and address, so a
single `search` term matches the order's customer name/phone **or** the user's
name/email/phone **or** any part of the delivery address.

Query params: `page`, `limit`, plus:

| Param | Type | Notes |
| --- | --- | --- |
| `search` | string (≤120) | see above |
| `status` | enum | `pending`\|`confirmed`\|`out for delivery`\|`delivered`\|`cancelled` |
| `dateFrom` | ISO date | lower bound on `createdAt` |
| `dateTo` | ISO date | upper bound on `createdAt` |

**200** → paginated list. Errors: **400**, **401**, **403**.

### `GET /api/orders/my` — List my orders

**Auth:** required. Returns only the caller's orders. Same `page`/`limit`/`search`/
`status`/`dateFrom`/`dateTo` params (search matches customerName/phone/bottleSize).
**200** → paginated list. Errors: **400**, **401**.

### `GET /api/orders/:id` — Get an order

**Auth:** owner or admin. **200** → order.
Errors: **400** (bad id), **401**, **403** `You can only access your own orders`,
**404** `Order not found`.

### `PATCH /api/orders/:id` — Edit an order (admin)

**Auth:** admin only. Body — at least one of `customerName`, `customerPhone`,
`bottleSize`, `quantity`, `amount`, `address`, `estimatedDelivery`, `status`.
**200** → updated order. Errors: **400**, **401**, **403**, **404**.

### `PATCH /api/orders/:id/status` — Update status (admin)

**Auth:** admin only. Body: `{ "status": "<OrderStatus>" }` (required).
**200** → updated order. Errors: **400** (invalid status / bad id), **401**, **403**, **404**.

### `DELETE /api/orders/:id` — Delete an order (admin)

**Auth:** admin only. **200** → `{ success, data: null }`.
Errors: **400**, **401**, **403**, **404**.

---

## Analytics  `/api/analytics`

`/my-orders` is available to any authenticated user; the three dashboards are
admin only. None are paginated.

### `GET /api/analytics/my-orders` — My order analytics

**Auth:** required (any user). The caller's own totals.

**200** →

```json
{ "success": true, "data": {
  "totalOrders": 5, "deliveredOrders": 2, "pendingOrders": 1,
  "outForDeliveryOrders": 1, "totalSpent": 250
} }
```

`totalSpent` = Σ(`quantity` × `amount`) over the caller's orders.
Errors: **401**.

### `GET /api/analytics/order-status` — Order status counts (admin)

**Auth:** admin only. **200** → a map of every status to its count (missing
statuses reported as `0`):

```json
{ "success": true, "data": {
  "pending": 5, "confirmed": 3, "out for delivery": 2, "delivered": 10, "cancelled": 1
} }
```

Errors: **401**, **403**.

### `GET /api/analytics/summary` — Platform totals (admin)

**Auth:** admin only. **200** →

```json
{ "success": true, "data": {
  "totalOrders": 21, "pendingOrders": 5, "deliveredOrders": 10, "totalUsers": 42
} }
```

Errors: **401**, **403**.

### `GET /api/analytics/monthly-trends` — Monthly bookings & queries (admin)

**Auth:** admin only. Dense, chart-ready series.

Query param: `year` (integer 2000–2100, optional; default the current year).
The `months` axis runs `1..currentMonth` for the current year, or `1..12` for a
past year; `bookings` and `queries` are count arrays aligned to it, zero-filled.

**200** →

```json
{ "success": true, "data": {
  "year": 2026,
  "months":   [1, 2, 3, 4, 5, 6, 7],
  "bookings": [0, 0, 0, 0, 0, 0, 8],
  "queries":  [0, 0, 0, 0, 0, 0, 12]
} }
```

Errors: **400** (out-of-range year), **401**, **403**.

---

## System

### `GET /api/health` — Health check

**Auth:** public. **200** → `{ "success": true, "message": "gannet API is healthy" }`.
