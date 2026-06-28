import mongoose from 'mongoose';

const interviewAssignmentSchema = new mongoose.Schema({
  job: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    required: true,
  },
  candidate: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  recruiter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  jobRole: {
    type: String,
    required: true,
  },
  jobDescription: {
    type: String,
    default: '',
  },
  skills: [String],

  status: {
    type: String,
    enum: ['pending', 'in-progress', 'completed', 'cancelled'],
    default: 'pending',
  },

  questions: [{
    id: Number,
    question: String,
    category: String,
  }],

  answers: [{
    questionId: Number,
    question: String,
    answer: String,
    score: Number,
    feedback: String,
    strength: String,
    improvement: String,
  }],

  report: {
    overallScore: Number,
    summary: String,
    strengths: [String],
    areasForImprovement: [String],
    detailedFeedback: [{
      questionNumber: Number,
      feedback: String,
    }],
    recommendation: {
      type: String,
      enum: ['Strong Hire', 'Hire', 'Consider', 'No Hire'],
    },
    suggestedRoles: [String],
    completedAt: Date,
  },

  assignedAt: {
    type: Date,
    default: Date.now,
  },
  startedAt: Date,
  completedAt: Date,
  expiresAt: Date,
}, { timestamps: true });

interviewAssignmentSchema.index({ job: 1, candidate: 1 });
interviewAssignmentSchema.index({ recruiter: 1 });
interviewAssignmentSchema.index({ candidate: 1, status: 1 });

const InterviewAssignment = mongoose.model('InterviewAssignment', interviewAssignmentSchema);

export default InterviewAssignment;
