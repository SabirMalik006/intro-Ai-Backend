import { Resend } from 'resend';

let _resend = null;
const getResend = () => {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
};

const FROM = () => ({
  name: process.env.EMAIL_FROM_NAME || 'SmartHire',
  address: process.env.EMAIL_FROM_ADDRESS || 'noreply@smarthire.site',
});

const FRONTEND_URL = () => process.env.FRONTEND_URL || 'http://localhost:3000';

const baseStyles = {
  body: 'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f7fc;',
  container: 'max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.06);',
  header: 'background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 32px 40px; text-align: center;',
  headerLogo: 'font-size: 28px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;',
  headerSub: 'font-size: 13px; color: #94a3b8; margin-top: 4px; letter-spacing: 1px;',
  body_pad: 'padding: 36px 40px;',
  h1: 'font-size: 22px; font-weight: 700; color: #0f172a; margin: 0 0 8px;',
  p: 'font-size: 15px; line-height: 1.7; color: #475569; margin: 0 0 16px;',
  small: 'font-size: 13px; color: #94a3b8;',
  btn: 'display: inline-block; padding: 12px 28px; border-radius: 10px; font-size: 15px; font-weight: 600; text-decoration: none; color: #ffffff; background: linear-gradient(135deg, #14b8a6 0%, #059669 100%);',
  divider: 'height: 1px; background: linear-gradient(to right, transparent, #e2e8f0, transparent); margin: 24px 0;',
  footer: 'padding: 24px 40px; text-align: center; background: #f8fafc; border-top: 1px solid #e2e8f0;',
  badge: 'display: inline-block; padding: 6px 16px; border-radius: 20px; font-size: 13px; font-weight: 600;',
};

const wrapHtml = (content) => `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="${baseStyles.body}">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding: 24px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="${baseStyles.container}">
        <tr><td style="${baseStyles.header}">
          <div style="${baseStyles.headerLogo}">SmartHire</div>
          <div style="${baseStyles.headerSub}">AI-POWERED RECRUITMENT PLATFORM</div>
        </td></tr>
        ${content}
        <tr><td style="${baseStyles.footer}">
          <p style="font-size: 12px; color: #94a3b8; margin: 0 0 8px;">
            SmartHire &mdash; AI-Powered Recruitment Platform
          </p>
          <p style="font-size: 12px; color: #cbd5e1; margin: 0;">
            This is an automated message. Please do not reply to this email.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

// ─── BASE SEND FUNCTION ───
export const sendEmail = async ({ to, subject, html }) => {
  try {
    const from = FROM();
    await getResend().emails.send({
      from: `${from.name} <${from.address}>`,
      to,
      subject,
      html,
    });
  } catch (error) {
    console.error(`[EMAIL FAILED] ${subject} to ${to}:`, error.message);
  }
};

// ─── TEMPLATES ───

export const sendWelcomeEmail = async (email, name, role) => {
  const roleLabel = role === 'recruiter' ? 'Recruiter' : 'Candidate';
  const html = wrapHtml(`
    <tr><td style="${baseStyles.body_pad}">
      <h1 style="${baseStyles.h1}">Welcome to SmartHire, ${name}! 👋</h1>
      <p style="${baseStyles.p}">
        We're thrilled to have you on board! Your account has been successfully created as a <strong>${roleLabel}</strong>.
      </p>
      <div style="background: #f0fdfa; border-radius: 12px; padding: 20px; margin: 20px 0; border-left: 4px solid #14b8a6;">
        <p style="font-size: 14px; color: #0f766e; margin: 0;">
          <strong>✓ Account created</strong><br>
          Email: ${email}<br>
          Role: ${roleLabel}
        </p>
      </div>
      <p style="${baseStyles.p}">
        ${role === 'recruiter'
          ? 'Start posting jobs, reviewing candidates, and building your dream team.'
          : 'Explore jobs, apply with your resume, and get AI-powered interview feedback.'}
      </p>
      <div style="text-align: center; margin: 28px 0;">
        <a href="${FRONTEND_URL()}/dashboard" style="${baseStyles.btn}">
          Go to Dashboard →
        </a>
      </div>
      <div style="${baseStyles.divider}"></div>
      <p style="${baseStyles.small}">
        If you didn't create this account, please ignore this email.
      </p>
    </td></tr>
  `);
  await sendEmail({ to: email, subject: `Welcome to SmartHire, ${name}! 🎉`, html });
};

export const sendInterviewAssignedEmail = async (candidateEmail, candidateName, jobRole, company, recruiterName, expiresAt, interviewId) => {
  const deadline = new Date(expiresAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const html = wrapHtml(`
    <tr><td style="${baseStyles.body_pad}">
      <h1 style="${baseStyles.h1}">Interview Assigned! 🎯</h1>
      <p style="${baseStyles.p}">Hi <strong>${candidateName}</strong>,</p>
      <p style="${baseStyles.p}">
        Great news! <strong>${recruiterName}</strong> has invited you to complete an interview for the position of
        <strong>${jobRole}</strong> at <strong>${company}</strong>.
      </p>
      <div style="background: #fff7ed; border-radius: 12px; padding: 20px; margin: 20px 0; border-left: 4px solid #f97316;">
        <p style="font-size: 14px; margin: 0; color: #9a3412;">
          <strong>⏰ Deadline:</strong> ${deadline}<br>
          <strong>💼 Position:</strong> ${jobRole}<br>
          <strong>🏢 Company:</strong> ${company}
        </p>
      </div>
      <p style="${baseStyles.p}">
        The interview includes AI-powered questions. Take your time and answer thoughtfully.
      </p>
      <div style="text-align: center; margin: 28px 0;">
        <a href="${FRONTEND_URL()}/dashboard/interviews" style="${baseStyles.btn}">
          Start Interview →
        </a>
      </div>
      <p style="${baseStyles.small}">The interview will expire on ${deadline}.</p>
    </td></tr>
  `);
  await sendEmail({ to: candidateEmail, subject: `Interview Invitation: ${jobRole} at ${company}`, html });
};

export const sendInterviewReportEmail = async (email, name, jobRole, company, overallScore, recommendation) => {
  const scoreColor = overallScore >= 75 ? '#059669' : overallScore >= 50 ? '#d97706' : '#dc2626';
  const scoreBg = overallScore >= 75 ? '#f0fdfa' : overallScore >= 50 ? '#fffbeb' : '#fef2f2';
  const html = wrapHtml(`
    <tr><td style="${baseStyles.body_pad}">
      <h1 style="${baseStyles.h1}">Interview Complete! 📊</h1>
      <p style="${baseStyles.p}">Hi <strong>${name}</strong>,</p>
      <p style="${baseStyles.p}">Your interview for <strong>${jobRole}</strong> at <strong>${company}</strong> has been completed and reviewed.</p>
      <div style="background: ${scoreBg}; border-radius: 12px; padding: 24px; margin: 20px 0; text-align: center; border-left: 4px solid ${scoreColor};">
        <div style="font-size: 42px; font-weight: 800; color: ${scoreColor};">${overallScore}%</div>
        <div style="font-size: 14px; color: #475569; margin-top: 4px;">Overall Performance Score</div>
        <div style="${baseStyles.badge}; background: ${scoreColor}; color: #fff; margin-top: 12px;">
          ${recommendation || 'N/A'}
        </div>
      </div>
      <div style="text-align: center; margin: 28px 0;">
        <a href="${FRONTEND_URL()}/dashboard/interviews" style="${baseStyles.btn}">
          View Full Report →
        </a>
      </div>
    </td></tr>
  `);
  await sendEmail({ to: email, subject: `Interview Report: ${jobRole} at ${company}`, html });
};

export const sendApplicationReceivedEmail = async (recruiterEmail, recruiterName, candidateName, jobTitle, candidateEmail) => {
  const html = wrapHtml(`
    <tr><td style="${baseStyles.body_pad}">
      <h1 style="${baseStyles.h1}">New Application Received 📥</h1>
      <p style="${baseStyles.p}">Hi <strong>${recruiterName}</strong>,</p>
      <p style="${baseStyles.p}">
        <strong>${candidateName}</strong> has applied for <strong>${jobTitle}</strong>.
      </p>
      <div style="background: #f0fdfa; border-radius: 12px; padding: 20px; margin: 20px 0; border-left: 4px solid #14b8a6;">
        <p style="font-size: 14px; margin: 0; color: #0f766e;">
          <strong>👤 Candidate:</strong> ${candidateName}<br>
          <strong>📧 Email:</strong> ${candidateEmail}<br>
          <strong>💼 Position:</strong> ${jobTitle}
        </p>
      </div>
      <div style="text-align: center; margin: 28px 0;">
        <a href="${FRONTEND_URL()}/dashboard/my-jobs" style="${baseStyles.btn}">
          Review Application →
        </a>
      </div>
    </td></tr>
  `);
  await sendEmail({ to: recruiterEmail, subject: `New Application: ${candidateName} applied for ${jobTitle}`, html });
};

export const sendApplicationConfirmationEmail = async (candidateEmail, candidateName, jobTitle, company) => {
  const html = wrapHtml(`
    <tr><td style="${baseStyles.body_pad}">
      <h1 style="${baseStyles.h1}">Application Submitted ✅</h1>
      <p style="${baseStyles.p}">Hi <strong>${candidateName}</strong>,</p>
      <p style="${baseStyles.p}">
        Your application for <strong>${jobTitle}</strong> at <strong>${company}</strong> has been received successfully!
      </p>
      <div style="background: #f0fdfa; border-radius: 12px; padding: 20px; margin: 20px 0; border-left: 4px solid #14b8a6;">
        <p style="font-size: 14px; margin: 0; color: #0f766e;">
          <strong>✓ Application Received</strong><br>
          <strong>💼 Position:</strong> ${jobTitle}<br>
          <strong>🏢 Company:</strong> ${company}
        </p>
      </div>
      <p style="${baseStyles.p}">
        The recruiter will review your application. You'll be notified when there's an update.
      </p>
      <div style="text-align: center; margin: 28px 0;">
        <a href="${FRONTEND_URL()}/dashboard" style="${baseStyles.btn}">
          Track Application →
        </a>
      </div>
    </td></tr>
  `);
  await sendEmail({ to: candidateEmail, subject: `Application Received: ${jobTitle} at ${company}`, html });
};

export const sendApplicationStatusEmail = async (candidateEmail, candidateName, jobTitle, company, newStatus) => {
  const statusLabels = {
    screened: 'Screened — Your application is being reviewed',
    interviewed: 'Interviewed — Interview completed',
    offered: 'Offered 🎉 — Congratulations!',
    hired: 'Hired 🎉 — Welcome to the team!',
    rejected: 'Rejected — Update on your application',
  };
  const statusColors = {
    screened: '#3b82f6',
    interviewed: '#8b5cf6',
    offered: '#059669',
    hired: '#059669',
    rejected: '#dc2626',
  };
  const label = statusLabels[newStatus] || `Status updated to ${newStatus}`;
  const color = statusColors[newStatus] || '#64748b';
  const bgColors = {
    screened: '#eff6ff',
    interviewed: '#f5f3ff',
    offered: '#f0fdfa',
    hired: '#f0fdfa',
    rejected: '#fef2f2',
  };
  const bg = bgColors[newStatus] || '#f8fafc';

  const html = wrapHtml(`
    <tr><td style="${baseStyles.body_pad}">
      <h1 style="${baseStyles.h1}">Application Update 🔔</h1>
      <p style="${baseStyles.p}">Hi <strong>${candidateName}</strong>,</p>
      <p style="${baseStyles.p}">There's an update on your application for <strong>${jobTitle}</strong> at <strong>${company}</strong>.</p>
      <div style="background: ${bg}; border-radius: 12px; padding: 20px; margin: 20px 0; border-left: 4px solid ${color};">
        <p style="font-size: 14px; margin: 0; color: #334155;">
          <strong style="color: ${color};">${label}</strong>
        </p>
      </div>
      <div style="text-align: center; margin: 28px 0;">
        <a href="${FRONTEND_URL()}/dashboard" style="${baseStyles.btn}">
          View Details →
        </a>
      </div>
    </td></tr>
  `);
  await sendEmail({ to: candidateEmail, subject: `Application Update: ${jobTitle} — ${newStatus.charAt(0).toUpperCase() + newStatus.slice(1)}`, html });
};

export const sendTeamInviteEmail = async (inviteEmail, inviterName, teamName, inviteToken) => {
  const inviteUrl = `${FRONTEND_URL()}/accept-invite?token=${inviteToken}`;
  const html = wrapHtml(`
    <tr><td style="${baseStyles.body_pad}">
      <h1 style="${baseStyles.h1}">Team Invitation 🤝</h1>
      <p style="${baseStyles.p}">Hi there,</p>
      <p style="${baseStyles.p}">
        <strong>${inviterName}</strong> has invited you to join the team <strong>${teamName}</strong> on SmartHire.
      </p>
      <div style="text-align: center; margin: 28px 0;">
        <a href="${inviteUrl}" style="${baseStyles.btn}">
          Accept Invitation →
        </a>
      </div>
      <p style="${baseStyles.small}">
        This invitation will expire in 7 days. If you don't have an account, you'll be prompted to create one.
      </p>
    </td></tr>
  `);
  await sendEmail({ to: inviteEmail, subject: `${inviterName} invited you to join ${teamName} on SmartHire`, html });
};

export const sendResumeAnalysisEmail = async (email, name, overallScore) => {
  const scoreColor = overallScore >= 75 ? '#059669' : overallScore >= 50 ? '#d97706' : '#dc2626';
  const scoreBg = overallScore >= 75 ? '#f0fdfa' : overallScore >= 50 ? '#fffbeb' : '#fef2f2';
  const html = wrapHtml(`
    <tr><td style="${baseStyles.body_pad}">
      <h1 style="${baseStyles.h1}}>Resume Analysis Complete 📄</h1>
      <p style="${baseStyles.p}">Hi <strong>${name}</strong>,</p>
      <p style="${baseStyles.p}">Your resume has been analyzed by our AI. Here's your score:</p>
      <div style="background: ${scoreBg}; border-radius: 12px; padding: 24px; margin: 20px 0; text-align: center; border-left: 4px solid ${scoreColor};">
        <div style="font-size: 42px; font-weight: 800; color: ${scoreColor};">${overallScore}%</div>
        <div style="font-size: 14px; color: #475569; margin-top: 4px;">Resume Score</div>
      </div>
      <div style="text-align: center; margin: 28px 0;">
        <a href="${FRONTEND_URL()}/dashboard/resume-analyzer" style="${baseStyles.btn}">
          View Full Analysis →
        </a>
      </div>
    </td></tr>
  `);
  await sendEmail({ to: email, subject: 'Your Resume Analysis is Ready!', html });
};

export const sendPasswordChangedEmail = async (email, name) => {
  const html = wrapHtml(`
    <tr><td style="${baseStyles.body_pad}">
      <h1 style="${baseStyles.h1}">Password Changed 🔒</h1>
      <p style="${baseStyles.p}">Hi <strong>${name}</strong>,</p>
      <p style="${baseStyles.p}">Your SmartHire account password was successfully changed.</p>
      <div style="background: #f0fdfa; border-radius: 12px; padding: 20px; margin: 20px 0; border-left: 4px solid #14b8a6;">
        <p style="font-size: 14px; margin: 0; color: #0f766e;">
          <strong>✓ Password updated successfully</strong><br>
          If you did not make this change, please contact support immediately.
        </p>
      </div>
      <div style="text-align: center; margin: 28px 0;">
        <a href="${FRONTEND_URL()}/login" style="${baseStyles.btn}">
          Go to Login →
        </a>
      </div>
    </td></tr>
  `);
  await sendEmail({ to: email, subject: 'Your SmartHire Password Has Been Changed', html });
};

export const sendAccountDeletedEmail = async (email, name) => {
  const html = wrapHtml(`
    <tr><td style="${baseStyles.body_pad}">
      <h1 style="${baseStyles.h1}">Account Deactivated</h1>
      <p style="${baseStyles.p}">Hi <strong>${name}</strong>,</p>
      <p style="${baseStyles.p}">Your SmartHire account has been deactivated as requested.</p>
      <div style="background: #fef2f2; border-radius: 12px; padding: 20px; margin: 20px 0; border-left: 4px solid #dc2626;">
        <p style="font-size: 14px; margin: 0; color: #991b1b;">
          <strong>⚠️ Account Deactivated</strong><br>
          All your data has been preserved. You can reactivate by contacting support.
        </p>
      </div>
      <p style="${baseStyles.small}">We're sorry to see you go. If you change your mind, we're here for you.</p>
    </td></tr>
  `);
  await sendEmail({ to: email, subject: 'SmartHire Account Deactivated', html });
};

export const sendOtpEmail = async (email, name, otp) => {
  const html = wrapHtml(`
    <tr><td style="${baseStyles.body_pad}">
      <h1 style="${baseStyles.h1}">Reset Your Password 🔑</h1>
      <p style="${baseStyles.p}">Hi <strong>${name}</strong>,</p>
      <p style="${baseStyles.p}">We received a request to reset your SmartHire account password. Use the OTP below:</p>
      <div style="background: #f0fdfa; border-radius: 16px; padding: 28px; margin: 24px 0; text-align: center; border: 2px dashed #14b8a6;">
        <div style="font-size: 42px; font-weight: 800; color: #0f172a; letter-spacing: 12px; font-family: 'Courier New', monospace;">${otp}</div>
        <p style="font-size: 13px; color: #64748b; margin: 12px 0 0;">This OTP expires in 5 minutes</p>
      </div>
      <p style="${baseStyles.small}">
        If you didn't request a password reset, please ignore this email. Your account remains secure.
      </p>
    </td></tr>
  `);
  await sendEmail({ to: email, subject: 'Your SmartHire Password Reset OTP', html });
};

export const sendPasswordResetSuccessEmail = async (email, name) => {
  const html = wrapHtml(`
    <tr><td style="${baseStyles.body_pad}">
      <h1 style="${baseStyles.h1}">Password Reset Successful ✅</h1>
      <p style="${baseStyles.p}">Hi <strong>${name}</strong>,</p>
      <p style="${baseStyles.p}">Your SmartHire account password has been reset successfully.</p>
      <div style="background: #f0fdfa; border-radius: 12px; padding: 20px; margin: 20px 0; border-left: 4px solid #14b8a6;">
        <p style="font-size: 14px; margin: 0; color: #0f766e;">
          <strong>✓ Password reset successful</strong><br>
          You can now log in with your new password.
        </p>
      </div>
      <div style="text-align: center; margin: 28px 0;">
        <a href="${FRONTEND_URL()}/login" style="${baseStyles.btn}">
          Go to Login →
        </a>
      </div>
    </td></tr>
  `);
  await sendEmail({ to: email, subject: 'Your SmartHire Password Has Been Reset', html });
};
