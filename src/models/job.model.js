import mongoose from 'mongoose';

const jobSchema = new mongoose.Schema({
  // ─── Job Details ───
  title: {
    type: String,
    required: [true, 'Job title is required'],
    trim: true,
    maxlength: [200, 'Job title cannot exceed 200 characters'],
  },
  department: {
    type: String,
    required: [true, 'Department is required'],
    enum: ['Engineering', 'Design', 'Product', 'Marketing', 'Sales', 'HR'],
  },
  type: {
    type: String,
    required: [true, 'Job type is required'],
    enum: ['Full-time', 'Part-time', 'Contract', 'Freelance', 'Internship'],
  },
  location: {
    type: String,
    required: [true, 'Location is required'],
    trim: true,
  },
  description: {
    type: String,
    required: [true, 'Job description is required'],
    maxlength: [5000, 'Description cannot exceed 5000 characters'],
  },
  requirements: {
    type: String,
    required: [true, 'Job requirements are required'],
    maxlength: [3000, 'Requirements cannot exceed 3000 characters'],
  },
  salary: {
    type: String,
    trim: true,
    default: '',
  },

  // ─── Status ───
  status: {
    type: String,
    enum: ['active', 'closed', 'draft'],
    default: 'active',
  },

  // ─── Who Posted It ───
  recruiter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Recruiter is required'],
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
jobSchema.index({ recruiter: 1, status: 1 });
jobSchema.index({ department: 1 });
jobSchema.index({ title: 'text', description: 'text' });

// Method to increment views
jobSchema.methods.incrementViews = async function () {
  this.views += 1;
  return this.save({ validateBeforeSave: false });
};

const Job = mongoose.model('Job', jobSchema);

export default Job;