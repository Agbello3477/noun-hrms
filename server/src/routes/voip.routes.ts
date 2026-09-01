import { Router } from 'express';
import { verifyToken } from '../middleware/auth.middleware';
import { 
  getVoipDirectory, 
  lookupExtension, 
  getIceServers, 
  getMyExtension,
  saveVoicemail,
  getVoicemails,
  markVoicemailListened,
  deleteVoicemail
} from '../controllers/voip.controller';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const audioStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.webm';
    cb(null, `voicemail-${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`);
  }
});

const audioUpload = multer({
  storage: audioStorage,
  limits: { fileSize: 15 * 1024 * 1024 } // 15MB limit
});

const router = Router();

router.use(verifyToken);

router.get('/my-extension', getMyExtension);
router.get('/directory', getVoipDirectory);
router.get('/lookup/:extension', lookupExtension);
router.get('/ice-servers', getIceServers);
router.get('/v1/webrtc/ice-servers', getIceServers);

// Phase 17: Voicemail & Voice Notes
router.post('/voicemail', audioUpload.single('audio'), saveVoicemail);
router.get('/voicemails', getVoicemails);
router.put('/voicemails/:id/listened', markVoicemailListened);
router.delete('/voicemails/:id', deleteVoicemail);

export default router;
