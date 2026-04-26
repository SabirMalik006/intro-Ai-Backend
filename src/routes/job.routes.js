import { Router } from 'express';
import {
  createJob,
  getMyJobs,
  getJob,
  updateJob,
  deleteJob,
  getRecruiterAnalytics,
  updateApplicationStatus,
} from '../controllers/job.controller.js';
import { protect, authorize } from '../middleware/auth.middleware.js';

const router = Router();

// All job routes require authentication
router.use(protect);

// ─── RECRUITER ONLY ROUTES ───
router.post('/', authorize('recruiter'), createJob);
router.get('/my-jobs', authorize('recruiter'), getMyJobs);
router.get('/analytics/overview', authorize('recruiter'), getRecruiterAnalytics);
router.put('/:jobId/applications/:applicationId', authorize('recruiter'), updateApplicationStatus);

// ─── JOB CRUD (Ownership checked in controller) ───
router.get('/:id', getJob);
router.put('/:id', updateJob);
router.delete('/:id', deleteJob);

export default router;