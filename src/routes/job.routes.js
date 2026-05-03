import { Router } from 'express';
import {
  createJob,
  getAllJobs,
  getMyJobs,
  getJob,
  updateJob,
  deleteJob,
  getRecruiterAnalytics,
  updateApplicationStatus,
  applyToJob,
} from '../controllers/job.controller.js';
import { protect, authorize } from '../middleware/auth.middleware.js';
import { validateJob, validateJobUpdate } from '../middleware/job.validation.js';
import { uploadResume } from '../middleware/upload.middleware.js';

const router = Router();

// ─── PUBLIC ROUTES ───
router.get('/', getAllJobs);

// ─── PROTECTED ROUTES (Require Auth) ───
router.use(protect);

router.post('/:id/apply', uploadResume.single('resume'), applyToJob);

// ─── RECRUITER ONLY ROUTES ───
router.get('/recruiter/my-jobs', authorize('recruiter'), getMyJobs);
router.get('/recruiter/analytics/overview', authorize('recruiter'), getRecruiterAnalytics);
router.post('/', authorize('recruiter'), validateJob, createJob);
router.put('/:id', authorize('recruiter'), validateJobUpdate, updateJob);
router.delete('/:id', authorize('recruiter'), deleteJob);
router.put('/:jobId/applications/:applicationId', authorize('recruiter'), updateApplicationStatus);

// ─── PUBLIC PARAMETERIZED ROUTES (Move to end) ───
router.get('/:id', getJob);

export default router;