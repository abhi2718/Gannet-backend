# gannet

A production-style **Node.js + Express + MongoDB** REST API written in **TypeScript**.

## Features

- **TypeScript** everywhere, all source under `src/`
- **Feature-based routing** — each route is a folder with `index.ts` (router), `controller.ts`, and `helpers.ts` (Joi schemas)
- **JWT authentication** — the token embeds **only the MongoDB user id**; the auth middleware verifies the Bearer token, loads the user, and attaches it to `req.user`
- **Joi validation** on request body / params / query
- **Global error handler** + **404 not-found handler** middleware
- **Rate limiting** (global + stricter on auth)
- **NoSQL injection protection** via `express-mongo-sanitize` + `helmet` + `cors`
- **Swagger** API docs at `/api-docs`
- **ESLint** flat config enforcing **max 200 lines/file** and **no unused variables**

## Project structure

```
src/
├── app.ts                  # Express app assembly
├── index.ts                # Server bootstrap + graceful shutdown
├── config/
│   ├── db.ts               # Mongo connection
│   ├── env.ts              # Validated env vars
│   └── swagger.ts          # Swagger setup
├── middlewares/
│   ├── auth.ts             # JWT authenticate + authorize
│   ├── errorHandler.ts     # Global error handler
│   ├── notFound.ts         # 404 handler
│   ├── rateLimiter.ts      # Rate limiters
│   └── validate.ts         # Joi validation
├── models/
│   ├── user.model.ts       # username, email, password, userType
│   └── product.model.ts    # productName, url, price, description
├── types/
│   └── express.d.ts        # Request.user augmentation
├── utils/
│   ├── ApiError.ts
│   ├── catchAsync.ts
│   └── jwt.ts
└── routes/
    ├── index.ts            # Route aggregator
    ├── auth/    { index, controller, helpers }
    ├── user/    { index, controller, helpers }
    └── product/ { index, controller, helpers }
```

## Getting started

```bash
npm install
cp .env.example .env      # then edit values
npm run dev               # start with hot reload
```

Other scripts:

```bash
npm run build       # compile to dist/
npm start           # run compiled app
npm run lint        # lint
npm run typecheck   # type-check only
```

## API

| Method | Endpoint             | Auth   | Description            |
| ------ | -------------------- | ------ | --------------------- |
| GET    | /api/health          | —      | Health check          |
| POST   | /api/auth/register   | —      | Register + get JWT    |
| POST   | /api/auth/login      | —      | Login + get JWT       |
| GET    | /api/auth/me         | Bearer | Current user          |
| GET    | /api/users           | Bearer | List users            |
| GET    | /api/users/:id       | Bearer | Get user              |
| PATCH  | /api/users/:id       | Bearer | Update user           |
| DELETE | /api/users/:id       | Admin  | Delete user           |
| GET    | /api/products        | Bearer | List products         |
| POST   | /api/products        | Bearer | Create product        |
| GET    | /api/products/:id    | Bearer | Get product           |
| PATCH  | /api/products/:id    | Bearer | Update product        |
| DELETE | /api/products/:id    | Bearer | Delete product        |

Interactive docs: `http://localhost:5000/api-docs`
