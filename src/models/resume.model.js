import mongoose from 'mongoose';

const resumeAnalysisSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  filename: {
    type: String,
    required: true,
  },
  fileUrl: {
    type: String,
  },
  analysisResult: {
    overallScore: Number,
    atsScore: Number,
    atsFeedback: String,
    sections: {
      contactInfo: { score: Number, feedback: String },
      summary: { score: Number, feedback: String },
      experience: { score: Number, feedback: String },
      education: { score: Number, feedback: String },
      skills: { score: Number, feedback: String },
      formatting: { score: Number, feedback: String },
    },
    extractedSkills: [String],
    suggestedJobRoles: [String],
    strengthPoints: [String],
    improvementAreas: [String],
    keywordsFound: [String],
    missingKeywords: [String],
  },
}, { timestamps: true });

const Resume = mongoose.model('Resume', resumeAnalysisSchema);

export default Resume;
