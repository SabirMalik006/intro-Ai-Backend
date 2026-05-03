import mongoose from 'mongoose';

const jobSchema = new mongoose.Schema({
  // ─── Job Details ───
  title: {
    type: String,
    required: [true, 'Job title is required'],
    trim: true,
    maxlength: [200, 'Job title cannot exceed 200 characters'],
  },
  company: {
    type: String,
    required: [true, 'Company name is required'],
    trim: true,
  },
  location: {
    type: String,
    required: [true, 'Location is required'],
    trim: true,
  },
  jobType: {
    type: String,
    required: [true, 'Job type is required'],
    enum: ['full-time', 'part-time', 'remote', 'hybrid', 'contract'],
  },
  experienceLevel: {
    type: String,
    required: [true, 'Experience level is required'],
    enum: ['entry', 'mid', 'senior', 'lead'],
  },
  salary: {
    min: { type: Number, default: 0 },
    max: { type: Number, default: 0 },
    currency: { type: String, default: 'PKR' },
  },
  description: {
    type: String,
    required: [true, 'Job description is required'],
    maxlength: [5000, 'Description cannot exceed 5000 characters'],
  },
  requirements: {
    type: [String],
    required: [true, 'Job requirements are required'],
  },
  skills: {
    type: [String],
    default: [],
  },
  applicationDeadline: {
    type: Date,
  },

  // ─── Backward Compatibility / Extra Fields ───
  department: {
    type: String,
    enum: ['Engineering', 'Design', 'Product', 'Marketing', 'Sales', 'HR'],
  },
  type: {
    type: String,
    enum: ['Full-time', 'Part-time', 'Contract', 'Freelance', 'Internship'],
  },

  // ─── Status ───
  status: {
    type: String,
    enum: ['active', 'closed', 'draft'],
    default: 'draft',
  },

  // ─── Ownership ───
  postedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User is required'],
  },

  // ─── Stats ───
  views: {
    type: Number,
    default: 0,
  },
  applicationsCount: {
    type: Number,
    default: 0,
  },

  // ─── Applications ───
  applications: [{
    candidate: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    fullName: String,
    email: String,
    phone: String,
    coverLetter: String,
    resumeUrl: String,
    status: {
      type: String,
      enum: ['applied', 'screened', 'interviewed', 'offered', 'hired', 'rejected'],
      default: 'applied',
    },
    appliedAt: {
      type: Date,
      default: Date.now,
    },
    score: {
      type: Number,
      default: 0,
    },
    notes: String,
  }],

}, { timestamps: true });

// Indexes for better query performance
jobSchema.index({ postedBy: 1, status: 1 });
jobSchema.index({ department: 1 });
jobSchema.index({ title: 'text', description: 'text', company: 'text' });

// Method to increment views
jobSchema.methods.incrementViews = async function () {
  this.views += 1;
  return this.save({ validateBeforeSave: false });
};

const Job = mongoose.model('Job', jobSchema);

export default Job;