import { Router } from 'express';
import {
  analyzeResume,
  getResumeHistory,
  getResumeReport,
} from '../controllers/resume.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

// STEP 5: Exact Multer Config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Save to 'uploads' folder in root of backend
    const uploadDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Unique filename without spaces
    cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '-'));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.pdf' || ext === '.docx') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and DOCX files are allowed'));
    }
  }
});

router.use(protect);

router.post('/analyze', upload.single('resume'), analyzeResume);
router.get('/history', getResumeHistory);
router.get('/report/:id', getResumeReport);

export default router;
