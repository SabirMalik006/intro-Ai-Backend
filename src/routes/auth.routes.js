import { Router } from 'express';
import passport from 'passport';
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
  getUserStats,
  googleCallback,
  forgotPassword,
  verifyOtp,
  resetPassword,
} from '../controllers/auth.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { checkLoginAttempts } from '../middleware/security.middleware.js';

const router = Router();

// ─── PUBLIC ROUTES ───
// Register new user
router.post('/register', register);

// Login user (with brute-force protection)
router.post('/login', checkLoginAttempts, login);

// Refresh access token
router.post('/refresh-token', refreshToken);

// ─── FORGOT PASSWORD / OTP ───
router.post('/forgot-password', forgotPassword);
router.post('/verify-otp', verifyOtp);
router.post('/reset-password', resetPassword);

// ─── GOOGLE OAUTH ───
// Start Google OAuth flow
router.get('/google', passport.authenticate('google', {
  scope: ['profile', 'email'],
  session: true,
}));

// Google OAuth callback
router.get('/google/callback',
  passport.authenticate('google', {
    failureRedirect: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=oauth_failed`,
    session: true,
  }),
  googleCallback
);

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