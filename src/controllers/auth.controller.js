import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/user.model.js';
import Otp from '../models/otp.model.js';
import InterviewAssignment from '../models/interviewAssignment.model.js';
import Job from '../models/job.model.js';
import { recordFailedAttempt, resetLoginAttempts } from '../middleware/security.middleware.js';
import {
  sendWelcomeEmail,
  sendPasswordChangedEmail,
  sendAccountDeletedEmail,
  sendOtpEmail,
  sendPasswordResetSuccessEmail,
} from '../services/email.service.js';

// =============================================
// HELPER: Parse time string to milliseconds
// =============================================
const parseTimeToMs = (str) => {
  if (!str) return 15 * 60 * 1000;
  const match = str.match(/^(\d+)([smhd])$/);
  if (!match) return 15 * 60 * 1000;
  const num = parseInt(match[1]);
  const unit = match[2];
  switch (unit) {
    case 's': return num * 1000;
    case 'm': return num * 60 * 1000;
    case 'h': return num * 60 * 60 * 1000;
    case 'd': return num * 24 * 60 * 60 * 1000;
    default: return 15 * 60 * 1000;
  }
};

// =============================================
// HELPER: Generate Tokens
// =============================================
const generateTokens = async (user) => {
  const accessToken = user.generateAccessToken();
  const refreshToken = user.generateRefreshToken();

  // Save refresh token in DB
  user.refreshToken = refreshToken;
  await user.save({ validateBeforeSave: false });

  return { accessToken, refreshToken };
};

// =============================================
// HELPER: Set Cookies
// =============================================
const setTokenCookies = (res, accessToken, refreshToken) => {
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
  };

  res.cookie('accessToken', accessToken, {
    ...cookieOptions,
    maxAge: parseTimeToMs(process.env.JWT_ACCESS_EXPIRY),
  });

  res.cookie('refreshToken', refreshToken, {
    ...cookieOptions,
    maxAge: parseTimeToMs(process.env.JWT_REFRESH_EXPIRY),
  });
};

// =============================================
// REGISTER
// POST /api/v1/auth/register
// =============================================
export const register = async (req, res, next) => {
  try {
    const { fullName, email, password, confirmPassword, role, company } = req.body;

    // Check if passwords match
    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match',
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists',
      });
    }

    // Validate recruiter has company
    if (role === 'recruiter' && !company) {
      return res.status(400).json({
        success: false,
        message: 'Company name is required for recruiters',
      });
    }

    // Create user
    const user = await User.create({
      fullName,
      email,
      password,
      role,
      company: role === 'recruiter' ? company : '',
    });

    // Generate tokens
    const { accessToken, refreshToken } = await generateTokens(user);

    // Set cookies
    setTokenCookies(res, accessToken, refreshToken);

    // Send welcome email
    await sendWelcomeEmail(user.email, user.fullName, user.role);

    // Remove password from response
    const userResponse = user.toJSON();

    res.status(201).json({
      success: true,
      message: 'Account created successfully! Welcome to SmartHire.',
      data: {
        user: userResponse,
        accessToken,
      },
    });
  } catch (error) {
    next(error);
  }
};

// =============================================
// LOGIN
// POST /api/v1/auth/login
// =============================================
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Check if email and password provided
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password',
      });
    }

    // Find user and include password
    const user = await User.findOne({ email }).select('+password');

    // Use generic message to prevent user enumeration
    const invalidMsg = 'Invalid email or password';

    if (!user) {
      recordFailedAttempt(email);
      return res.status(401).json({
        success: false,
        message: invalidMsg,
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Please contact support.',
      });
    }

    // Compare password
    const isPasswordMatch = await user.comparePassword(password);
    if (!isPasswordMatch) {
      recordFailedAttempt(email);
      return res.status(401).json({
        success: false,
        message: invalidMsg,
      });
    }

    // Reset failed attempts on successful login
    resetLoginAttempts(email);

    // Update last login
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    // Generate tokens
    const { accessToken, refreshToken } = await generateTokens(user);

    // Set cookies
    setTokenCookies(res, accessToken, refreshToken);

    // Remove password from response
    const userResponse = user.toJSON();

    res.status(200).json({
      success: true,
      message: `Welcome back, ${user.fullName}!`,
      data: {
        user: userResponse,
        accessToken,
      },
    });
  } catch (error) {
    next(error);
  }
};

// =============================================
// LOGOUT
// POST /api/v1/auth/logout
// =============================================
export const logout = async (req, res, next) => {
  try {
    // Clear refresh token from DB
    if (req.user) {
      await User.findByIdAndUpdate(req.user._id, { refreshToken: null });
    }

    // Clear cookies
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');

    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    next(error);
  }
};

// =============================================
// GET CURRENT USER (PROTECTED)
// GET /api/v1/auth/me
// =============================================
export const searchUsers = async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) {
      return res.json({ success: true, data: [] });
    }

    const users = await User.find({
      _id: { $ne: req.user._id },
      $or: [
        { fullName: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
      ],
    })
      .select('fullName email role avatar company')
      .limit(20)
      .lean();

    res.json({ success: true, data: users });
  } catch (error) {
    next(error);
  }
};

export const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.status(200).json({
      success: true,
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};

// =============================================
// REFRESH TOKEN
// POST /api/v1/auth/refresh-token
// =============================================
export const refreshToken = async (req, res, next) => {
  try {
    const incomingRefreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

    if (!incomingRefreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token not found',
      });
    }

    // Verify refresh token
    const decoded = jwt.verify(incomingRefreshToken, process.env.JWT_REFRESH_SECRET);

    // Find user with the refresh token
    const user = await User.findById(decoded.id).select('+refreshToken');

    if (!user || user.refreshToken !== incomingRefreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token',
      });
    }

    // Generate new tokens
    const accessToken = user.generateAccessToken();
    const newRefreshToken = user.generateRefreshToken();

    user.refreshToken = newRefreshToken;
    await user.save({ validateBeforeSave: false });

    // Set new cookies
    setTokenCookies(res, accessToken, newRefreshToken);

    res.status(200).json({
      success: true,
      message: 'Token refreshed successfully',
      data: { accessToken },
    });
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token. Please login again.',
      });
    }
    next(error);
  }
};

// =============================================
// UPDATE PROFILE (PROTECTED)
// PUT /api/v1/auth/update-profile
// =============================================
export const updateProfile = async (req, res, next) => {
  try {
    const allowedFields = ['fullName', 'phone', 'bio', 'skills', 'notificationPreferences'];
    const updates = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    // Prevent email change through this endpoint
    if (req.body.email) {
      return res.status(400).json({
        success: false,
        message: 'Email cannot be changed. Contact support for email changes.',
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};

// =============================================
// DELETE ACCOUNT (PROTECTED)
// DELETE /api/v1/auth/delete-account
// =============================================
export const deleteAccount = async (req, res, next) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Password is required to delete your account',
      });
    }

    const user = await User.findById(req.user._id).select('+password');

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Password is incorrect',
      });
    }

    await User.findByIdAndUpdate(req.user._id, { isActive: false });

    // Send account deactivation email
    await sendAccountDeletedEmail(user.email, user.fullName);

    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');

    res.status(200).json({
      success: true,
      message: 'Account deactivated successfully. We\'re sorry to see you go.',
    });
  } catch (error) {
    next(error);
  }
};

// =============================================
// UPDATE PASSWORD (PROTECTED)
// PUT /api/v1/auth/update-password
// =============================================
export const updatePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide current and new password',
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 8 characters',
      });
    }

    // Get user with password
    const user = await User.findById(req.user._id).select('+password');

    // Check current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect',
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    // Send password changed notification
    await sendPasswordChangedEmail(user.email, user.fullName);

    // Generate new tokens (invalidate old ones)
    const { accessToken, refreshToken } = await generateTokens(user);
    setTokenCookies(res, accessToken, refreshToken);

    res.status(200).json({
      success: true,
      message: 'Password updated successfully',
      data: { accessToken },
    });
  } catch (error) {
    next(error);
  }
};

// =============================================
// GOOGLE OAUTH CALLBACK
// GET /api/v1/auth/google/callback
// =============================================
export const googleCallback = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=oauth_failed`);
    }

    const { accessToken, refreshToken } = await generateTokens(req.user);
    setTokenCookies(res, accessToken, refreshToken);

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/dashboard`);
  } catch (error) {
    next(error);
  }
};

// =============================================
// FORGOT PASSWORD — Send OTP
// POST /api/v1/auth/forgot-password
// =============================================
export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Please provide your email address',
      });
    }

    const user = await User.findOne({ email });

    // Don't reveal if user exists or not (security)
    if (!user) {
      return res.status(200).json({
        success: true,
        message: 'If an account exists with this email, you will receive an OTP.',
      });
    }

    // ─── Rate limiting ───
    const windowMinutes = parseInt(process.env.OTP_RATE_LIMIT_WINDOW_MINUTES) || 15;
    const maxRequests = parseInt(process.env.OTP_RATE_LIMIT_MAX_REQUESTS) || 4;
    const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);

    const recentRequests = await Otp.countDocuments({
      email,
      createdAt: { $gte: windowStart },
    });

    if (recentRequests >= maxRequests) {
      return res.status(429).json({
        success: false,
        message: `Too many attempts. Please try again after ${windowMinutes} minutes.`,
      });
    }

    // ─── Generate OTP ───
    const otp = crypto.randomInt(100000, 999999).toString();
    const expiryMinutes = parseInt(process.env.OTP_EXPIRY_MINUTES) || 5;
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

    await Otp.create({
      email,
      otp,
      type: 'password_reset',
      expiresAt,
      maxAttempts: parseInt(process.env.OTP_MAX_ATTEMPTS) || 3,
    });

    // ─── Send OTP email ───
    await sendOtpEmail(email, user.fullName, otp);

    res.status(200).json({
      success: true,
      message: 'OTP sent to your email. Please check your inbox.',
    });
  } catch (error) {
    next(error);
  }
};

// =============================================
// VERIFY OTP
// POST /api/v1/auth/verify-otp
// =============================================
export const verifyOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Email and OTP are required',
      });
    }

    // Find the latest valid OTP
    const otpRecord = await Otp.findOne({
      email,
      type: 'password_reset',
      used: false,
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: 'No valid OTP found. Please request a new one.',
      });
    }

    // Check attempts
    if (otpRecord.attempts >= otpRecord.maxAttempts) {
      otpRecord.used = true;
      await otpRecord.save();
      return res.status(400).json({
        success: false,
        message: 'Too many incorrect attempts. Please request a new OTP.',
      });
    }

    // Verify OTP
    const isValid = await otpRecord.compareOtp(otp);

    if (!isValid) {
      otpRecord.attempts += 1;
      await otpRecord.save();
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP. Please try again.',
      });
    }

    // Mark as used
    otpRecord.used = true;
    await otpRecord.save();

    // Generate a reset token for password reset
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

    // Store reset token in user document
    await User.findOneAndUpdate(
      { email },
      {
        resetPasswordToken: resetTokenHash,
        resetPasswordExpires: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
      }
    );

    res.status(200).json({
      success: true,
      message: 'OTP verified successfully',
      data: { resetToken },
    });
  } catch (error) {
    next(error);
  }
};

// =============================================
// RESET PASSWORD
// POST /api/v1/auth/reset-password
// =============================================
export const resetPassword = async (req, res, next) => {
  try {
    const { email, resetToken, newPassword } = req.body;

    if (!email || !resetToken || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Email, reset token, and new password are required',
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters',
      });
    }

    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

    const user = await User.findOne({
      email,
      resetPasswordToken: resetTokenHash,
      resetPasswordExpires: { $gt: new Date() },
    }).select('+password');

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token. Please request a new OTP.',
      });
    }

    // Update password
    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    await sendPasswordResetSuccessEmail(user.email, user.fullName);

    res.status(200).json({
      success: true,
      message: 'Password has been reset successfully. Please log in with your new password.',
    });
  } catch (error) {
    next(error);
  }
};

// ─── GET USER STATS ───
export const getUserStats = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id).select('role');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const isCandidate = user.role?.toLowerCase().includes('candidate') || user.role?.toLowerCase() === 'user';
    const stats = {};

    if (isCandidate) {
      const assignments = await InterviewAssignment.find({ candidate: id });
      const total = assignments.length;
      const completed = assignments.filter(a => a.status === 'completed').length;
      const scores = assignments
        .filter(a => a.status === 'completed' && a.report?.overallScore != null)
        .map(a => a.report.overallScore);
      const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
      const passed = scores.filter(s => s >= 60).length;
      const successRate = scores.length ? Math.round((passed / scores.length) * 100) : 0;

      stats.interviews = total;
      stats.completed = completed;
      stats.avgScore = avgScore;
      stats.successRate = successRate;
      stats.highestScore = scores.length ? Math.max(...scores) : 0;
    } else {
      const jobs = await Job.find({ postedBy: id });
      const totalJobs = jobs.length;
      const activeJobs = jobs.filter(j => j.status === 'active').length;
      const totalApplicants = jobs.reduce((sum, j) => sum + (j.applications?.length || 0), 0);
      const hired = jobs.reduce((sum, j) => sum + (j.applications?.filter(a => a.status === 'hired').length || 0), 0);

      stats.jobs = totalJobs;
      stats.activeJobs = activeJobs;
      stats.candidates = totalApplicants;
      stats.hired = hired;
    }

    res.json({ success: true, data: stats });
  } catch (error) {
    next(error);
  }
};