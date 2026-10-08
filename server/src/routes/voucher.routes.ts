import { Router } from 'express';
import { createVoucher, getVouchers, updateVoucherStatus } from '../controllers/voucher.controller';
import { verifyToken } from '../middleware/auth.middleware';

const router = Router();

router.use(verifyToken);

router.post('/', createVoucher);
router.get('/', getVouchers);
router.put('/:id/status', updateVoucherStatus);

export default router;
