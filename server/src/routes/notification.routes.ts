
import { Router } from 'express';
import { getNotifications, markAsRead, markAllRead, deleteNotification, registerFcmToken } from '../controllers/notification.controller';
import { verifyToken } from '../middleware/auth.middleware';

const router = Router();

router.use(verifyToken);

router.get('/', getNotifications);
router.post('/fcm-token', registerFcmToken);
router.put('/:id/read', markAsRead);
router.put('/read-all', markAllRead);
router.delete('/:id', deleteNotification);

export default router;
