import Job from '../models/job.model.js';
import User from '../models/user.model.js';
import asyncHandler from '../utils/asyncHandler.js';

// =============================================
// CREATE JOB (Recruiter Only)
// POST /api/v1/jobs
// =============================================
export const createJob = asyncHandler(async (req, res, next) => {
  const {
    title, company, location, jobType, experienceLevel,
    salary, description, requirements, skills,
    applicationDeadline, status, department, type
  } = req.body;

  // Double check role (though middleware should handle it)
  if (req.user.role !== 'recruiter') {
    return res.status(403).json({
      success: false,
      message: 'Only recruiters can post jobs',
      code: 'AUTH_FORBIDDEN'
    });
  }

  const job = await Job.create({
    title,
    company,
    location,
    jobType,
    experienceLevel,
    salary,
    description,
    requirements,
    skills,
    applicationDeadline,
    status: status || 'draft',
    department, // for backward compatibility
    type, // for backward compatibility
    postedBy: req.user._id,
  });

  res.status(201).json({
    success: true,
    message: 'Job posted successfully',
    data: { job },
  });
});

// =============================================
// GET ALL JOBS (Public with filters)
// GET /api/v1/jobs
// =============================================
export const getAllJobs = asyncHandler(async (req, res, next) => {
  const {
    status = 'active',
    jobType,
    experienceLevel,
    location,
    search,
    page = 1,
    limit = 10
  } = req.query;

  const query = { status };

  if (jobType) query.jobType = jobType;
  if (experienceLevel) query.experienceLevel = experienceLevel;
  if (location) query.location = { $regex: location, $options: 'i' };
  if (search) {
    query.$text = { $search: search };
  }

  const total = await Job.countDocuments(query);
  const jobs = await Job.find(query)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit))
    .select('-applications');

  res.status(200).json({
    success: true,
    data: {
      jobs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    },
  });
});

// =============================================
// GET RECRUITER'S OWN JOBS
// GET /api/v1/jobs/recruiter/my-jobs
// =============================================
export const getMyJobs = asyncHandler(async (req, res, next) => {
  const { status, page = 1, limit = 10 } = req.query;

  const query = { postedBy: req.user._id };
  if (status) query.status = status;

  const total = await Job.countDocuments(query);
  const jobs = await Job.find(query)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit))
    .select('-applications');

  res.status(200).json({
    success: true,
    data: {
      jobs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    },
  });
});

// =============================================
// GET SINGLE JOB
// GET /api/v1/jobs/:id
// =============================================
export const getJob = asyncHandler(async (req, res, next) => {
  const job = await Job.findById(req.params.id)
    .populate('postedBy', 'fullName email company')
    .populate('applications.candidate', 'fullName email avatar skills');

  if (!job) {
    return res.status(404).json({
      success: false,
      message: 'Job not found',
      code: 'JOB_NOT_FOUND'
    });
  }

  // If not recruiter and job is draft, don't show
  if (job.status === 'draft' && (!req.user || job.postedBy._id.toString() !== req.user._id.toString())) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to view this draft',
      code: 'AUTH_FORBIDDEN'
    });
  }

  // Increment views safely
  await job.incrementViews();

  res.status(200).json({
    success: true,
    data: { job },
  });
});

// =============================================
// UPDATE JOB
// PUT /api/v1/jobs/:id
// =============================================
export const updateJob = asyncHandler(async (req, res, next) => {
  const job = await Job.findById(req.params.id);

  if (!job) {
    return res.status(404).json({
      success: false,
      message: 'Job not found',
      code: 'JOB_NOT_FOUND'
    });
  }

  // Check ownership
  if (job.postedBy.toString() !== req.user._id.toString()) {
    return res.status(403).json({
      success: false,
      message: 'You can only update your own jobs',
      code: 'AUTH_FORBIDDEN'
    });
  }

  const updatedJob = await Job.findByIdAndUpdate(
    req.params.id,
    { $set: req.body },
    { new: true, runValidators: true }
  );

  res.status(200).json({
    success: true,
    message: 'Job updated successfully',
    data: { job: updatedJob },
  });
});

// =============================================
// DELETE JOB
// DELETE /api/v1/jobs/:id
// =============================================
export const deleteJob = asyncHandler(async (req, res, next) => {
  const job = await Job.findById(req.params.id);

  if (!job) {
    return res.status(404).json({
      success: false,
      message: 'Job not found',
      code: 'JOB_NOT_FOUND'
    });
  }

  if (job.postedBy.toString() !== req.user._id.toString()) {
    return res.status(403).json({
      success: false,
      message: 'You can only delete your own jobs',
      code: 'AUTH_FORBIDDEN'
    });
  }

  await job.deleteOne();

  res.status(200).json({
    success: true,
    message: 'Job deleted successfully',
  });
});

// =============================================
// GET RECRUITER ANALYTICS
// GET /api/v1/jobs/analytics/overview
// =============================================
export const getRecruiterAnalytics = asyncHandler(async (req, res, next) => {
  const recruiterId = req.user._id;

  const totalJobs = await Job.countDocuments({ postedBy: recruiterId });
  const activeJobs = await Job.countDocuments({ postedBy: recruiterId, status: 'active' });
  const closedJobs = await Job.countDocuments({ postedBy: recruiterId, status: 'closed' });

  const jobsWithApplications = await Job.find({ postedBy: recruiterId })
    .select('applications applicationsCount views title jobType');

  const totalApplications = jobsWithApplications.reduce((sum, job) => sum + (job.applicationsCount || 0), 0);
  const totalViews = jobsWithApplications.reduce((sum, job) => sum + (job.views || 0), 0);

  // Job Type distribution
  const jobTypeStats = {};
  jobsWithApplications.forEach(job => {
    if (!jobTypeStats[job.jobType]) jobTypeStats[job.jobType] = 0;
    jobTypeStats[job.jobType]++;
  });

  // Top jobs by applications
  const topJobs = jobsWithApplications
    .sort((a, b) => b.applicationsCount - a.applicationsCount)
    .slice(0, 5)
    .map(job => ({
      title: job.title,
      applications: job.applicationsCount,
      views: job.views,
    }));

  // Recent applications across all recruiter's jobs
  const recruiterJobs = await Job.find({ postedBy: recruiterId })
    .populate('applications.candidate', 'fullName email avatar')
    .sort({ 'applications.appliedAt': -1 });

  const recentApplications = [];
  recruiterJobs.forEach(job => {
    job.applications.forEach(app => {
      if (app.candidate) {
        recentApplications.push({
          candidate: app.candidate,
          jobTitle: job.title,
          status: app.status,
          appliedAt: app.appliedAt,
        });
      }
    });
  });

  recentApplications.sort((a, b) => new Date(b.appliedAt) - new Date(a.appliedAt));

  res.status(200).json({
    success: true,
    data: {
      totalJobs,
      activeJobs,
      closedJobs,
      totalApplications,
      totalViews,
      jobTypeStats,
      topJobs,
      recentApplications: recentApplications.slice(0, 10),
    },
  });
});

// =============================================
// UPDATE APPLICATION STATUS
// PUT /api/v1/jobs/:jobId/applications/:applicationId
// =============================================
export const updateApplicationStatus = asyncHandler(async (req, res, next) => {
  const { status, score, notes } = req.body;
  const { jobId, applicationId } = req.params;

  const job = await Job.findById(jobId);

  if (!job) {
    return res.status(404).json({ success: false, message: 'Job not found' });
  }

  if (job.postedBy.toString() !== req.user._id.toString()) {
    return res.status(403).json({ success: false, message: 'Not authorized' });
  }

  const application = job.applications.id(applicationId);
  if (!application) {
    return res.status(404).json({ success: false, message: 'Application not found' });
  }

  if (status) application.status = status;
  if (score !== undefined) application.score = score;
  if (notes) application.notes = notes;

  await job.save();

  res.status(200).json({
    success: true,
    message: 'Application updated',
    data: { application },
  });
});

// =============================================
// APPLY TO JOB
// POST /api/v1/jobs/:id/apply
// =============================================
export const applyToJob = asyncHandler(async (req, res, next) => {
  console.log('📦 Application received:', {
    body: req.body,
    file: req.file ? req.file.originalname : 'No file',
    headers: req.headers['content-type']
  });
  
  const { fullName, email, phone, coverLetter } = req.body;
  const job = await Job.findById(req.params.id);

  if (!job) {
    return res.status(404).json({ success: false, message: 'Job not found' });
  }

  // Check if job is active
  if (job.status !== 'active') {
    return res.status(400).json({ success: false, message: 'This job is no longer accepting applications' });
  }

  // Check if already applied
  const alreadyApplied = job.applications.find(
    (app) => app.candidate.toString() === req.user._id.toString()
  );

  if (alreadyApplied) {
    return res.status(400).json({ success: false, message: 'You have already applied for this job' });
  }

  // Check for resume file
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Please upload your resume' });
  }

  // Add application
  job.applications.push({
    candidate: req.user._id,
    fullName,
    email,
    phone,
    coverLetter,
    resumeUrl: req.file.path.replace(/\\/g, '/'), // Normalize path
    appliedAt: new Date(),
    status: 'applied',
  });

  // Increment application count
  job.applicationsCount = (job.applicationsCount || 0) + 1;

  await job.save({ validateBeforeSave: false });

  res.status(200).json({
    success: true,
    message: 'Applied successfully',
  });
});