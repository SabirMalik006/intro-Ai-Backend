import Resume from '../models/resume.model.js';
import Job from '../models/job.model.js';
import User from '../models/user.model.js';
import asyncHandler from '../utils/asyncHandler.js';

export const getDashboardStats = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const userRole = req.user.role;

  const user = await User.findById(userId).select('fullName email role company');

  const totalAnalyses = await Resume.countDocuments({ userId });
  const recentAnalyses = await Resume.find({ userId })
    .sort({ createdAt: -1 })
    .limit(5)
    .select('filename analysisResult.overallScore createdAt');

  let totalApplications = 0;
  let activeJobs = 0;
  let totalJobs = 0;
  let topJobs = [];

  if (userRole === 'recruiter') {
    const jobs = await Job.find({ postedBy: userId }).select('title applicationsCount status jobType');
    totalJobs = jobs.length;
    activeJobs = jobs.filter(j => j.status === 'active').length;
    totalApplications = jobs.reduce((sum, j) => sum + (j.applicationsCount || 0), 0);
    topJobs = jobs
      .sort((a, b) => (b.applicationsCount || 0) - (a.applicationsCount || 0))
      .slice(0, 5)
      .map(j => ({ title: j.title, applications: j.applicationsCount || 0, status: j.status }));
  } else {
    const appliedJobs = await Job.find({ 'applications.candidate': userId })
      .select('title company')
      .limit(10);
    totalApplications = appliedJobs.length;
  }

  const avgScore = totalAnalyses > 0
    ? await Resume.aggregate([
        { $match: { userId: userId } },
        { $group: { _id: null, avg: { $avg: '$analysisResult.overallScore' } } }
      ])
    : [];

  const performanceData = await Resume.aggregate([
    { $match: { userId: userId } },
    { $sort: { createdAt: 1 } },
    { $group: {
        _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
        avgScore: { $avg: '$analysisResult.overallScore' },
        count: { $sum: 1 }
    }},
    { $sort: { _id: 1 } },
    { $limit: 12 }
  ]);

  res.status(200).json({
    success: true,
    data: {
      user: {
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        company: user.company,
      },
      stats: {
        totalAnalyses,
        totalApplications,
        activeJobs,
        totalJobs,
        avgScore: avgScore.length > 0 ? Math.round(avgScore[0].avg) : 0,
      },
      recentAnalyses: recentAnalyses.map(r => ({
        id: r._id,
        filename: r.filename,
        score: r.analysisResult?.overallScore || 0,
        date: r.createdAt,
      })),
      topJobs,
      performanceData: performanceData.map(p => ({
        month: p._id,
        score: Math.round(p.avgScore),
        count: p.count,
      })),
    }
  });
});
