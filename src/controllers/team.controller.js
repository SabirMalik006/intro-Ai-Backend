import crypto from 'crypto';
import Team from '../models/team.model.js';
import User from '../models/user.model.js';

// =============================================
// GET MY TEAM
// GET /api/v1/team
// =============================================
export const getMyTeam = async (req, res, next) => {
  try {
    let team = await Team.findOne({ owner: req.user._id })
      .populate('members.user', 'fullName email avatar role')
      .populate('invites.invitedBy', 'fullName email');

    if (!team) {
      team = await Team.create({
        owner: req.user._id,
        members: [{ user: req.user._id, role: 'admin', joinedAt: Date.now() }],
      });
      team = await Team.findById(team._id)
        .populate('members.user', 'fullName email avatar role')
        .populate('invites.invitedBy', 'fullName email');
    }

    res.status(200).json({
      success: true,
      data: { team },
    });
  } catch (error) {
    next(error);
  }
};

// =============================================
// INVITE MEMBER
// POST /api/v1/team/invite
// =============================================
export const inviteMember = async (req, res, next) => {
  try {
    const { email, role } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required',
      });
    }

    const invitedUser = await User.findOne({ email });

    let team = await Team.findOne({ owner: req.user._id });

    if (!team) {
      team = await Team.create({
        owner: req.user._id,
        members: [{ user: req.user._id, role: 'admin', joinedAt: Date.now() }],
      });
    }

    // Check if user is already a member
    const isMember = team.members.some(m => {
      if (invitedUser) {
        return m.user?.toString() === invitedUser._id.toString();
      }
      return false;
    });

    if (isMember) {
      return res.status(400).json({
        success: false,
        message: 'This user is already a team member',
      });
    }

    // Check if already invited
    const isInvited = team.invites.some(
      i => i.email === email.toLowerCase() && i.status === 'pending'
    );

    if (isInvited) {
      return res.status(400).json({
        success: false,
        message: 'An invitation has already been sent to this email',
      });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    team.invites.push({
      email,
      role: role || 'member',
      token,
      invitedBy: req.user._id,
      expiresAt,
    });

    await team.save();

    res.status(200).json({
      success: true,
      message: `Invitation sent to ${email}`,
      data: { token },
    });
  } catch (error) {
    next(error);
  }
};

// =============================================
// REMOVE MEMBER
// DELETE /api/v1/team/members/:memberId
// =============================================
export const removeMember = async (req, res, next) => {
  try {
    const team = await Team.findOne({ owner: req.user._id });

    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found',
      });
    }

    const memberIndex = team.members.findIndex(
      m => m.user?.toString() === req.params.memberId
    );

    if (memberIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Member not found in your team',
      });
    }

    if (team.members[memberIndex].role === 'admin') {
      return res.status(400).json({
        success: false,
        message: 'Cannot remove an admin. Transfer ownership first.',
      });
    }

    team.members.splice(memberIndex, 1);
    await team.save();

    res.status(200).json({
      success: true,
      message: 'Member removed from team',
    });
  } catch (error) {
    next(error);
  }
};

// =============================================
// REVOKE INVITE
// DELETE /api/v1/team/invites/:inviteId
// =============================================
export const revokeInvite = async (req, res, next) => {
  try {
    const team = await Team.findOne({ owner: req.user._id });

    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found',
      });
    }

    const inviteIndex = team.invites.findIndex(
      i => i._id.toString() === req.params.inviteId
    );

    if (inviteIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Invite not found',
      });
    }

    team.invites.splice(inviteIndex, 1);
    await team.save();

    res.status(200).json({
      success: true,
      message: 'Invitation revoked',
    });
  } catch (error) {
    next(error);
  }
};
