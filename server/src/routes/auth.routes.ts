import { Router } from 'express';
import { register, login, getMe, validatePassword, changePassword, forgotPassword } from '../controllers/auth.controller';
import { verifyToken } from '../middleware/auth.middleware';
import { validate, registerSchema, loginSchema, changePasswordSchema, forgotPasswordSchema } from '../middleware/validation';

const router = Router();

router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.get('/me', verifyToken, getMe);
router.post('/validate-password', verifyToken, validatePassword);
router.post('/change-password', verifyToken, validate(changePasswordSchema), changePassword);
router.post('/forgot-password', validate(forgotPasswordSchema), forgotPassword);

export default router;
