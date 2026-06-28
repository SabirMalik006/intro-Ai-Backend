import { Router } from 'express';
import {
  register,
  login,
  logout,
  getMe,
  refreshToken,
  updatePassword,
  updateProfile,
  deleteAccount,
  searchUsers,
  getUserStats
} from '../controllers/auth.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = Router();

// ─── PUBLIC ROUTES ───
// Register new user
router.post('/register', register);

// Login user
router.post('/login', login);

// Refresh access token
router.post('/refresh-token', refreshToken);

// ─── PROTECTED ROUTES (requires login) ───
// Get current logged-in user
router.get('/me', protect, getMe);

// Logout user
router.post('/logout', protect, logout);

// Update password
router.put('/update-password', protect, updatePassword);

// Update profile
router.put('/update-profile', protect, updateProfile);

// Delete account
router.delete('/delete-account', protect, deleteAccount);

// Search users
router.get('/search-users', protect, searchUsers);

// Get user stats
router.get('/:id/stats', protect, getUserStats);

export default router;