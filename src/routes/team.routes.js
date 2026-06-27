import { Router } from 'express';
import {
  getMyTeam,
  inviteMember,
  removeMember,
  revokeInvite,
} from '../controllers/team.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = Router();

router.use(protect);

router.get('/', getMyTeam);
router.post('/invite', inviteMember);
router.delete('/members/:memberId', removeMember);
router.delete('/invites/:inviteId', revokeInvite);

export default router;
