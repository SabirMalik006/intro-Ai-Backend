import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import User from '../models/user.model.js';

export function configurePassport() {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/v1/auth/google/callback`,
    passReqToCallback: true,
  }, async (req, accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails?.[0]?.value;
      if (!email) {
        return done(new Error('No email found from Google account'), null);
      }

      let user = await User.findOne({ email });

      if (user) {
        user.googleId = profile.id;
        user.authProvider = 'google';
        user.avatar = user.avatar || profile.photos?.[0]?.value || '';
        user.lastLogin = new Date();
        await user.save({ validateBeforeSave: false });
      } else {
        user = await User.create({
          fullName: profile.displayName,
          email,
          googleId: profile.id,
          authProvider: 'google',
          avatar: profile.photos?.[0]?.value || '',
          role: 'candidate',
          isActive: true,
        });
      }

      return done(null, user);
    } catch (error) {
      return done(error, null);
    }
  }));

  passport.serializeUser((user, done) => {
    done(null, user._id);
  });

  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id);
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  });
}
