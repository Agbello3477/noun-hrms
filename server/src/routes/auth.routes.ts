import { Router } from 'express';
import { register, login, getMe, validatePassword, changePassword, forgotPassword, setup2FA, verifyAndEnable2FA, verify2FALogin } from '../controllers/auth.controller';
import { verifyToken } from '../middleware/auth.middleware';
import { validate, registerSchema, loginSchema, changePasswordSchema, forgotPasswordSchema } from '../middleware/validation';
import { authLimiter } from '../middleware/rateLimiter';

const router = Router();

router.post('/register', authLimiter, validate(registerSchema), register);
router.post('/login', authLimiter, validate(loginSchema), login);
router.get('/me', verifyToken, getMe);
router.post('/validate-password', verifyToken, validatePassword);
router.post('/change-password', verifyToken, validate(changePasswordSchema), changePassword);
router.post('/forgot-password', authLimiter, validate(forgotPasswordSchema), forgotPassword);

// 2FA Routes
router.post('/2fa/setup', setup2FA);
router.post('/2fa/verify-enable', verifyAndEnable2FA);
router.post('/2fa/verify-login', authLimiter, verify2FALogin);

export default router;
