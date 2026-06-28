import { Router } from 'express';
import {
  assignInterview,
  getRecruiterInterviews,
  getMyInterviews,
  getInterview,
  startInterview,
  submitAnswer,
  completeInterview,
  cancelInterview,
  deleteInterview,
} from '../controllers/interview.controller.js';
import { protect, authorize } from '../middleware/auth.middleware.js';

const router = Router();

router.use(protect);

// ─── RECRUITER ROUTES ───
router.post('/assign', authorize('recruiter'), assignInterview);
router.get('/recruiter', authorize('recruiter'), getRecruiterInterviews);
router.put('/:id/cancel', authorize('recruiter'), cancelInterview);

// ─── CANDIDATE ROUTES ───
router.get('/mine', getMyInterviews);
router.put('/:id/start', startInterview);
router.put('/:id/answer', submitAnswer);
router.put('/:id/complete', completeInterview);

// ─── SHARED ───
router.get('/:id', getInterview);
router.delete('/:id', deleteInterview);

export default router;
