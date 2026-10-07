import { Router } from 'express';
import { authenticate, ownerOnly, allRoles, AuthRequest } from '../../middleware/auth';
import { Settings } from './model';
import { UpdateSettingsSchema } from '@hs-pharma/shared';

const router = Router();
router.use(authenticate);

router.get('/', allRoles, async (req, res, next) => {
  try {
    let s = await Settings.findOne();
    if (!s) s = await Settings.create({});
    res.json({ ok: true, data: s });
  } catch (err) { next(err); }
});

router.put('/', ownerOnly, async (req: AuthRequest, res, next) => {
  try {
    const body = UpdateSettingsSchema.parse(req.body);
    const s = await Settings.findOneAndUpdate({}, body, { new: true, upsert: true });
    res.json({ ok: true, data: s });
  } catch (err) { next(err); }
});

export default router;
