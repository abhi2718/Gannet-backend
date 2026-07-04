import { Router } from "express";
import { authenticate } from "../../middlewares/auth";
import { authRateLimiter } from "../../middlewares/rateLimiter";
import { validate } from "../../middlewares/validate";
import { login, me, register } from "./controller";
import { loginSchema, registerSchema } from "./helpers";

const router = Router();

/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new user
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, email, phoneNumber, password]
 *             properties:
 *               username: { type: string }
 *               email: { type: string, format: email }
 *               phoneNumber: { type: string }
 *               password: { type: string, format: password }
 *               userType: { type: string, enum: [admin, customer] }
 *     responses:
 *       201: { description: User created }
 */
router.post("/register", authRateLimiter, validate(registerSchema), register);

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Log in and receive a JWT
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string, format: password }
 *     responses:
 *       200: { description: Authenticated }
 */
router.post("/login", authRateLimiter, validate(loginSchema), login);

/**
 * @openapi
 * /api/auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Get the current authenticated user
 *     responses:
 *       200: { description: Current user }
 *       401: { description: Unauthorized }
 */
router.get("/me", authenticate, me);

export default router;
