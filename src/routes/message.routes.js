import { Router } from 'express';
import { protect } from '../middleware/auth.middleware.js';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import {
  getConversations,
  getOrCreateConversation,
  getMessages,
  sendMessage,
  markAsRead,
  uploadFile,
  clearChat,
  deleteConversation,
} from '../controllers/message.controller.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'chat');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, unique + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|mp4|mov|avi|mkv/i;
    const ext = allowed.test(path.extname(file.originalname));
    const mime = allowed.test(file.mimetype);
    if (ext || mime) return cb(null, true);
    cb(new Error('Only images and videos are allowed'));
  },
});

const router = Router();

router.use(protect);

router.get('/conversations', getConversations);
router.get('/conversations/:id/messages', getMessages);
router.post('/conversations/:recipientId', getOrCreateConversation);
router.post('/conversations/:id/messages', sendMessage);
router.patch('/conversations/:id/read', markAsRead);
router.post('/upload', upload.single('file'), uploadFile);
router.delete('/conversations/:id/clear', clearChat);
router.delete('/conversations/:id', deleteConversation);

export default router;
