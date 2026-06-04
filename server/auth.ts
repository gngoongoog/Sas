import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'supersas_jwt_default_secret_key_102830';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';

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

// Generate JWT token with 24 Hours expiry
export function generateToken(payload: AdminPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
}

// Verify a login attempt (supports both plain string and bcrypt hashes)
export function verifyAdminLogin(username: string, password_raw: string): boolean {
  if (username !== ADMIN_USERNAME) return false;
  const adminPass = process.env.ADMIN_PASSWORD || 'admin';
  if (adminPass.startsWith('$2')) {
    try {
      return bcrypt.compareSync(password_raw, adminPass);
    } catch (e) {
      return false;
    }
  }
  return password_raw === adminPass;
}

// Express JWT Auth Middleware with detailed Arabic error messages
export function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'عذراً، يجب تسجيل الدخول للوصول لهذه الإجراءات (رمز مصادقة غير موجود).' });
    }

    // Support both Bearer <token> and raw token
    let token = authHeader;
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as AdminPayload;
      req.admin = decoded;
      next();
    } catch (error) {
      return res.status(403).json({ error: 'انتهت صلاحية جلسة العمل، يرجى إعادة تسجيل الدخول.' });
    }
  } catch (err) {
    console.error('Auth middleware server error:', err);
    return res.status(500).json({ error: 'حدث خطأ غير متوقع في نظام التحقق من الهوية.' });
  }
}
