import Job from '../models/job.model.js';
import User from '../models/user.model.js';

// =============================================
// CREATE JOB (Recruiter Only)
// POST /api/v1/jobs
// =============================================
export const createJob = async (req, res, next) => {
  try {
    const { title, department, type, location, description, requirements, salary } = req.body;

    // Validate recruiter
    if (req.user.role !== 'recruiter') {
      return res.status(403).json({
        success: false,
        message: 'Only recruiters can post jobs',
      });
    }

    const job = await Job.create({
      title,
      department,
      type,
      location,
      description,
      requirements,
      salary: salary || '',
      recruiter: req.user._id,
    });

    res.status(201).json({
      success: true,
      message: 'Job posted successfully',
      data: { job },
    });
  } catch (error) {
    next(error);
  }
};

// =============================================
// GET ALL JOBS (For Recruiter - Their Own Jobs)
// GET /api/v1/jobs/my-jobs
// =============================================
export const getMyJobs = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;

    // Build query - only this recruiter's jobs
    const query = { recruiter: req.user._id };
    if (status) query.status = status;

    const total = await Job.countDocuments(query);
    const jobs = await Job.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .select('-applications'); // Don't send all applications in list

    res.status(200).json({
      success: true,
      data: {
        jobs,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrev: page > 1,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// =============================================
// GET SINGLE JOB (Recruiter's Own Job)
// GET /api/v1/jobs/:id
// =============================================
export const getJob = async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.id)
      .populate('applications.candidate', 'fullName email avatar skills');

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found',
      });
    }

    // Check if this recruiter owns the job
    if (job.recruiter.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only view your own jobs',
      });
    }

    // Increment views
    await job.incrementViews();

    res.status(200).json({
      success: true,
      data: { job },
    });
  } catch (error) {
    next(error);
  }
};

// =============================================
// UPDATE JOB (Recruiter Only)
// PUT /api/v1/jobs/:id
// =============================================
export const updateJob = async (req, res, next) => {
  try {
    const { title, department, type, location, description, requirements, salary, status } = req.body;

    const job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found',
      });
    }

    // Check ownership
    if (job.recruiter.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only update your own jobs',
      });
    }

    // Update fields
    if (title) job.title = title;
    if (department) job.department = department;
    if (type) job.type = type;
    if (location) job.location = location;
    if (description) job.description = description;
    if (requirements) job.requirements = requirements;
    if (salary !== undefined) job.salary = salary;
    if (status) job.status = status;

    await job.save();

    res.status(200).json({
      success: true,
      message: 'Job updated successfully',
      data: { job },
    });
  } catch (error) {
    next(error);
  }
};

// =============================================
// DELETE JOB (Recruiter Only)
// DELETE /api/v1/jobs/:id
// =============================================
export const deleteJob = async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found',
      });
    }

    if (job.recruiter.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own jobs',
      });
    }

    await job.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Job deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

// =============================================
// GET RECRUITER ANALYTICS
// GET /api/v1/jobs/analytics/overview
// =============================================
export const getRecruiterAnalytics = async (req, res, next) => {
  try {
    const recruiterId = req.user._id;

    // Total jobs
    const totalJobs = await Job.countDocuments({ recruiter: recruiterId });

    // Active jobs
    const activeJobs = await Job.countDocuments({ recruiter: recruiterId, status: 'active' });

    // Closed jobs
    const closedJobs = await Job.countDocuments({ recruiter: recruiterId, status: 'closed' });

    // Total applications across all jobs
    const jobsWithApplications = await Job.find({ recruiter: recruiterId }).select('applications applicationsCount views title department');

    const totalApplications = jobsWithApplications.reduce((sum, job) => sum + job.applicationsCount, 0);
    const totalViews = jobsWithApplications.reduce((sum, job) => sum + (job.views || 0), 0);

    // Department distribution
    const departmentStats = {};
    jobsWithApplications.forEach(job => {
      if (!departmentStats[job.department]) {
        departmentStats[job.department] = 0;
      }
      departmentStats[job.department]++;
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

    // Recent applications
    const recentApplications = [];
    jobsWithApplications.forEach(job => {
      job.applications.forEach(app => {
        if (app.candidate) {
          recentApplications.push({
            candidate: app.candidate,
            jobTitle: job.title,
            status: app.status,
            score: app.score,
            appliedAt: app.appliedAt,
          });
        }
      });
    });
    recentApplications.sort((a, b) => b.appliedAt - a.appliedAt);

    res.status(200).json({
      success: true,
      data: {
        totalJobs,
        activeJobs,
        closedJobs,
        totalApplications,
        totalViews,
        departmentStats,
        topJobs,
        recentApplications: recentApplications.slice(0, 10),
      },
    });
  } catch (error) {
    next(error);
  }
};

// =============================================
// UPDATE APPLICATION STATUS
// PUT /api/v1/jobs/:jobId/applications/:applicationId
// =============================================
export const updateApplicationStatus = async (req, res, next) => {
  try {
    const { status, score, notes } = req.body;
    const { jobId, applicationId } = req.params;

    const job = await Job.findById(jobId);

    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    if (job.recruiter.toString() !== req.user._id.toString()) {
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
  } catch (error) {
    next(error);
  }
};