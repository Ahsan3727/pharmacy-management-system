import { Router, Request, Response } from 'express';
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { rateLimit } from 'express-rate-limit';
import { env } from '../../config/env';
import { User } from '../users/model';
import { AppError } from '../../common/errors';
import { authenticate, AuthRequest } from '../../middleware/auth';
import { LoginSchema } from '@hs-pharma/shared';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { ok: false, error: { code: 'RATE_LIMITED', message: 'Too many login attempts. Wait 15 minutes.' } },
});

function signTokens(userId: string, role: string) {
  const access = jwt.sign({ sub: userId, role }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.ACCESS_TOKEN_TTL,
  } as any);
  const refresh = jwt.sign({ sub: userId, type: 'refresh' }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.REFRESH_TOKEN_TTL,
  } as any);
  return { access, refresh };
}

// POST /api/v1/auth/login
router.post('/login', loginLimiter, async (req: Request, res: Response, next) => {
  try {
    const body = LoginSchema.parse(req.body);
    const user = await User.findOne({ username: body.username.toLowerCase(), isActive: true });
    if (!user) throw new AppError('INVALID_CREDENTIALS', 401, 'Invalid username or password');

    const valid = await argon2.verify(user.passwordHash, body.password);
    if (!valid) throw new AppError('INVALID_CREDENTIALS', 401, 'Invalid username or password');

    await User.updateOne({ _id: user._id }, { lastLoginAt: new Date() });

    const tokens = signTokens(String(user._id), user.role);
    res.cookie('refreshToken', tokens.refresh, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: '/api/v1/auth',
    });

    res.json({
      ok: true,
      data: {
        accessToken: tokens.access,
        user: { id: user._id, name: user.name, username: user.username, role: user.role },
      },
    });
  } catch (err) { next(err); }
});

// POST /api/v1/auth/refresh
router.post('/refresh', async (req: Request, res: Response, next) => {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) throw new AppError('UNAUTHORIZED', 401, 'No refresh token');

    const payload = jwt.verify(token, env.JWT_REFRESH_SECRET) as any;
    if (payload.type !== 'refresh') throw new AppError('UNAUTHORIZED', 401, 'Invalid refresh token');

    const user = await User.findById(payload.sub).select('_id role isActive');
    if (!user || !user.isActive) throw new AppError('UNAUTHORIZED', 401, 'User not found');

    const tokens = signTokens(String(user._id), user.role);
    // Rotate refresh token
    res.cookie('refreshToken', tokens.refresh, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: '/api/v1/auth',
    });

    res.json({ ok: true, data: { accessToken: tokens.access } });
  } catch (err) { next(err); }
});

// POST /api/v1/auth/logout
router.post('/logout', (_req, res) => {
  res.clearCookie('refreshToken', { path: '/api/v1/auth' });
  res.json({ ok: true, data: null });
});

// GET /api/v1/auth/me
router.get('/me', authenticate, (req: AuthRequest, res) => {
  res.json({ ok: true, data: req.user });
});

export default router;
