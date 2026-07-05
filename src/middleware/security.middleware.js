// ─── Account Lockout Tracker ───
const loginAttempts = new Map();

const CLEANUP_INTERVAL = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000;

// Periodic cleanup of stale entries
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of loginAttempts.entries()) {
    if (now - value.lastAttempt > LOCKOUT_DURATION) {
      loginAttempts.delete(key);
    }
  }
}, CLEANUP_INTERVAL);

export const checkLoginAttempts = (req, res, next) => {
  const email = req.body?.email?.toLowerCase().trim();
  if (!email) return next();

  const record = loginAttempts.get(email);
  const now = Date.now();

  if (record) {
    // If locked out and lockout hasn't expired
    if (record.lockedUntil && now < record.lockedUntil) {
      const remaining = Math.ceil((record.lockedUntil - now) / 1000 / 60);
      return res.status(429).json({
        success: false,
        message: `Too many login attempts. Account locked for ${remaining} minute(s). Please try again later.`,
      });
    }

    // Lockout expired, reset
    if (record.lockedUntil && now >= record.lockedUntil) {
      loginAttempts.delete(email);
    }
  }

  next();
};

export const recordFailedAttempt = (email) => {
  if (!email) return;

  const now = Date.now();
  const record = loginAttempts.get(email) || { count: 0, lastAttempt: now };

  record.count += 1;
  record.lastAttempt = now;

  if (record.count >= MAX_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_DURATION;
  }

  loginAttempts.set(email, record);
};

export const resetLoginAttempts = (email) => {
  if (!email) return;
  loginAttempts.delete(email);
};

export const getLoginAttempts = () => ({
  size: loginAttempts.size,
  maxAttempts: MAX_ATTEMPTS,
  lockoutDuration: LOCKOUT_DURATION,
});
