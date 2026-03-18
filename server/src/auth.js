import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { config } from "./config.js";
import { store } from "./store.js";
import { recordAudit } from "./audit.js";

const roles = ["Admin", "Estimator", "Viewer"];

const registerSchema = z.object({
  companyName: z.string().min(2),
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8)
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

const normalizeEmail = (email) => email.trim().toLowerCase();

const sanitizeUser = (user) => ({
  ...user,
  passwordHash: undefined
});

export const makeToken = (user) =>
  jwt.sign({ sub: user.id, companyId: user.companyId, role: user.role }, config.jwtSecret, {
    expiresIn: "7d"
  });

export const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const payload = jwt.verify(authHeader.slice(7), config.jwtSecret);
    const user = await store.find("users", (entry) => entry.id === payload.sub && entry.isActive !== false);
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    req.user = user;
    return next();
  } catch {
    return res.status(401).json({ message: "Unauthorized" });
  }
};

export const authorize = (...allowedRoles) => (req, res, next) => {
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ message: "Forbidden" });
  }

  return next();
};

export const register = async (req, res) => {
  const payload = registerSchema.parse(req.body);
  const email = normalizeEmail(payload.email);
  const existing = await store.find("users", (user) => normalizeEmail(user.email) === email);

  if (existing) {
    return res.status(409).json({ message: "Email already exists" });
  }

  const company = await store.insert("companies", {
    name: payload.companyName,
    slug: payload.companyName.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    ownerId: "",
    plan: "Starter",
    createdAt: new Date().toISOString()
  });

  const passwordHash = await bcrypt.hash(payload.password, 10);
  const user = await store.insert("users", {
    companyId: company.id,
    name: payload.name,
    email,
    passwordHash,
    role: "Admin",
    isActive: true,
    createdAt: new Date().toISOString()
  });

  const updatedCompany = await store.update("companies", company.id, { ownerId: user.id });
  await recordAudit({
    companyId: company.id,
    actorUserId: user.id,
    action: "auth.register",
    entityType: "user",
    entityId: user.id,
    details: { email }
  });

  return res.json({
    token: makeToken(user),
    user: sanitizeUser(user),
    company: updatedCompany
  });
};

export const login = async (req, res) => {
  const payload = loginSchema.parse(req.body);
  const email = normalizeEmail(payload.email);
  const user = await store.find("users", (entry) => normalizeEmail(entry.email) === email && entry.isActive !== false);

  if (!user) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const valid = await bcrypt.compare(payload.password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  await recordAudit({
    companyId: user.companyId,
    actorUserId: user.id,
    action: "auth.login",
    entityType: "user",
    entityId: user.id,
    details: { email }
  });

  return res.json({
    token: makeToken(user),
    user: sanitizeUser(user),
    company: await store.find("companies", (entry) => entry.id === user.companyId)
  });
};

export const forgotPassword = async (req, res) => {
  const email = normalizeEmail(z.string().email().parse(req.body.email));
  const user = await store.find("users", (entry) => normalizeEmail(entry.email) === email);

  if (!user) {
    return res.json({ message: "If the email exists, a reset link has been prepared." });
  }

  const reset = await store.insert("resets", {
    userId: user.id,
    email,
    token: randomBytes(24).toString("hex"),
    createdAt: new Date().toISOString()
  });

  await recordAudit({
    companyId: user.companyId,
    actorUserId: user.id,
    action: "auth.forgot_password",
    entityType: "reset",
    entityId: reset.id,
    details: { email }
  });

  return res.json({
    message: "Password reset token generated for demo mode.",
    resetToken: reset.token
  });
};

export const isValidRole = (role) => roles.includes(role);
