import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'supersas_jwt_default_secret_key_102830';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';

// Default pre-defined admin password hash
// If ADMIN_PASSWORD is provided in .env, we can verify against it.
// Default fallback password: 'admin' if not set in .env
const ADMIN_PASSWORD_RAW = process.env.ADMIN_PASSWORD || 'admin';
const ADMIN_PASSWORD_HASH = bcrypt.hashSync(ADMIN_PASSWORD_RAW, 10);

export interface AdminPayload {
  username: string;
  role: 'admin';
}

declare global {
  namespace Express {
    interface Request {
      admin?: AdminPayload;
    }
  }
}

// Generate JWT token
export function generateToken(payload: AdminPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

// Verify a login attempt
export function verifyAdminLogin(username: string, password_raw: string): boolean {
  if (username !== ADMIN_USERNAME) return false;
  return bcrypt.compareSync(password_raw, ADMIN_PASSWORD_HASH);
}

// Express JWT Auth Middleware
export function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'عذراً، يجب تسجيل الدخول للوصول لهذه الإجراءات (رمز مصادقة غير موجود).' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AdminPayload;
    req.admin = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'انتهت صلاحية جلسة العمل، يرجى إعادة تسجيل الدخول.' });
  }
}
