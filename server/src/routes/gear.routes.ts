import { Router } from 'express';
import { getGearList, addGearItem, loanGearItem, returnGearItem, getGearLoans } from '../controllers/gear.controller';
import { verifyToken } from '../middleware/auth.middleware';

const router = Router();

router.use(verifyToken);

router.get('/', getGearList);
router.post('/', addGearItem);
router.post('/loans', loanGearItem);
router.put('/loans/:id/return', returnGearItem);
router.get('/loans', getGearLoans);

export default router;
