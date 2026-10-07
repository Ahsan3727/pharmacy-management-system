import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { AppError } from '../common/errors';
import { User } from '../modules/users/model';

export interface AuthRequest extends Request {
  user?: {
    _id: string;
    username: string;
    role: 'owner' | 'manager' | 'cashier';
    name: string;
  };
}

export async function authenticate(
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer '))
      throw new AppError('UNAUTHORIZED', 401, 'No access token');

    const token = header.slice(7);
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as any;

    const user = await User.findById(payload.sub).select('name username role isActive');
    if (!user || !user.isActive)
      throw new AppError('UNAUTHORIZED', 401, 'User not found or inactive');

    req.user = {
      _id: String(user._id),
      username: user.username,
      role: user.role,
      name: user.name,
    };
    next();
  } catch (err) {
    if (err instanceof AppError) { next(err); return; }
    next(new AppError('UNAUTHORIZED', 401, 'Invalid or expired token'));
  }
}

export function requireRole(...roles: Array<'owner' | 'manager' | 'cashier'>) {
  return (req: AuthRequest, _res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      next(new AppError('FORBIDDEN', 403, 'You do not have permission for this action'));
      return;
    }
    next();
  };
}

// Convenience aliases
export const ownerOnly = requireRole('owner');
export const managerOrOwner = requireRole('manager', 'owner');
export const allRoles = requireRole('owner', 'manager', 'cashier');
