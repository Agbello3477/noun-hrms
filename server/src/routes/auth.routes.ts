import { Router } from 'express';
import { register, login, getMe, validatePassword, changePassword, forgotPassword } from '../controllers/auth.controller';
import { verifyToken } from '../middleware/auth.middleware';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', verifyToken, getMe);
router.post('/validate-password', verifyToken, validatePassword);
router.post('/change-password', verifyToken, changePassword);
router.post('/forgot-password', forgotPassword);

export default router;
