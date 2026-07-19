import OpenAI from 'openai';
import InterviewAssignment from '../models/interviewAssignment.model.js';
import Job from '../models/job.model.js';
import User from '../models/user.model.js';
import asyncHandler from '../utils/asyncHandler.js';
import {
  sendInterviewAssignedEmail,
  sendInterviewReportEmail,
} from '../services/email.service.js';

const getOpenAIClient = () => {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY is missing in environment variables');
  }
  return new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
    defaultHeaders: {
      "HTTP-Referer": process.env.FRONTEND_URL || 'http://localhost:3000',
      "X-Title": "SmartHire",
    }
  });
};

// =============================================
// ASSIGN INTERVIEW (Recruiter)
// POST /api/v1/interviews/assign
// =============================================
export const assignInterview = asyncHandler(async (req, res, next) => {
  const { jobId, candidateId } = req.body;

  if (!jobId || !candidateId) {
    return res.status(400).json({
      success: false,
      message: 'Job ID and Candidate ID are required',
    });
  }

  const job = await Job.findById(jobId);
  if (!job) {
    return res.status(404).json({ success: false, message: 'Job not found' });
  }

  if (job.postedBy.toString() !== req.user._id.toString()) {
    return res.status(403).json({ success: false, message: 'You can only assign interviews for your own jobs' });
  }

  // Check if already assigned
  const existing = await InterviewAssignment.findOne({
    job: jobId,
    candidate: candidateId,
    status: { $in: ['pending', 'in-progress'] },
  });

  if (existing) {
    return res.status(400).json({
      success: false,
      message: 'Interview already assigned to this candidate',
    });
  }

  const skills = job.skills || [];
  const skillText = skills.length ? skills.join(', ') : 'relevant professional skills';

  // Generate questions using AI
  const prompt = `You are a technical interviewer at SmartHire. Generate exactly 6 interview questions for the role of "${job.title}".

Job Description: ${job.description || 'N/A'}
Required Skills: ${skillText}

Return ONLY a valid JSON array (no markdown, no extra text) with exactly 6 objects, each containing:
{
  "id": number (1-6),
  "question": "string",
  "category": "Technical" | "Behavioral" | "Situational" | "Experience"
}

Mix technical and behavioral questions appropriately for this role based on the job description and required skills.`;

  let questions = [];

  try {
    const openai = getOpenAIClient();
    const response = await openai.chat.completions.create({
      model: 'openai/gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'You are an expert interviewer. Return ONLY valid JSON arrays.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 1500,
    });

    const content = response.choices[0]?.message?.content || '';
    const cleaned = content.replace(/```(?:json)?\s*/gi, '').trim();
    const parsed = JSON.parse(cleaned);

    if (Array.isArray(parsed) && parsed.length === 6) {
      questions = parsed;
    }
  } catch (err) {
    console.error('AI question generation failed, using fallback:', err.message);
  }

  // Fallback questions if AI fails
  if (questions.length === 0) {
    questions = [
      { id: 1, question: `Tell me about your experience with ${skillText} and how it applies to the ${job.title} role.`, category: 'Experience' },
      { id: 2, question: 'Describe a challenging project you worked on and how you overcame obstacles.', category: 'Behavioral' },
      { id: 3, question: `What technical skills do you consider most important for a ${job.title} and why?`, category: 'Technical' },
      { id: 4, question: 'How do you stay updated with industry trends and new technologies?', category: 'Behavioral' },
      { id: 5, question: 'Tell me about a time you had to work under pressure to meet a tight deadline.', category: 'Situational' },
      { id: 6, question: 'Where do you see yourself professionally in the next 3-5 years?', category: 'Experience' },
    ];
  }

  const assignment = await InterviewAssignment.create({
    job: jobId,
    candidate: candidateId,
    recruiter: req.user._id,
    jobRole: job.title,
    jobDescription: job.description || '',
    skills,
    questions,
    status: 'pending',
    expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
  });

  // Update application status to 'screened'
  const application = job.applications.find(
    app => app.candidate.toString() === candidateId
  );
  if (application && application.status === 'applied') {
    application.status = 'screened';
    await job.save({ validateBeforeSave: false });
  }

  // Send email notification to candidate
  try {
    const candidate = await User.findById(candidateId).select('fullName email');
    if (candidate) {
      await sendInterviewAssignedEmail(
        candidate.email,
        candidate.fullName,
        job.title,
        job.company,
        req.user.fullName,
        assignment.expiresAt,
        assignment._id
      );
    }
  } catch (emailErr) {
    console.error('Failed to send interview email:', emailErr.message);
  }

  res.status(201).json({
    success: true,
    message: 'Interview assigned successfully',
    data: { assignment },
  });
});

// =============================================
// GET RECRUITER'S ASSIGNED INTERVIEWS
// GET /api/v1/interviews/recruiter
// =============================================
export const getRecruiterInterviews = asyncHandler(async (req, res, next) => {
  const { status, page = 1, limit = 20 } = req.query;

  const query = { recruiter: req.user._id };
  if (status) query.status = status;

  const total = await InterviewAssignment.countDocuments(query);
  const interviews = await InterviewAssignment.find(query)
    .populate('candidate', 'fullName email avatar')
    .populate('job', 'title company')
    .sort({ assignedAt: -1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

  res.status(200).json({
    success: true,
    data: {
      interviews,
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
// GET CANDIDATE'S ASSIGNED INTERVIEWS
// GET /api/v1/interviews/mine
// =============================================
export const getMyInterviews = asyncHandler(async (req, res, next) => {
  const { status } = req.query;

  const query = { candidate: req.user._id };
  if (status) query.status = status;

  const interviews = await InterviewAssignment.find(query)
    .populate('recruiter', 'fullName email company')
    .populate('job', 'title company')
    .sort({ assignedAt: -1 });

  res.status(200).json({
    success: true,
    data: { interviews },
  });
});

// =============================================
// GET SINGLE INTERVIEW DETAILS
// GET /api/v1/interviews/:id
// =============================================
export const getInterview = asyncHandler(async (req, res, next) => {
  const interview = await InterviewAssignment.findById(req.params.id)
    .populate('candidate', 'fullName email avatar skills')
    .populate('recruiter', 'fullName email company')
    .populate('job', 'title company location');

  if (!interview) {
    return res.status(404).json({ success: false, message: 'Interview not found' });
  }

  // Only recruiter or candidate can view
  const isRecruiter = interview.recruiter._id.toString() === req.user._id.toString();
  const isCandidate = interview.candidate._id.toString() === req.user._id.toString();

  if (!isRecruiter && !isCandidate) {
    return res.status(403).json({ success: false, message: 'Not authorized' });
  }

  res.status(200).json({
    success: true,
    data: { interview },
  });
});

// =============================================
// START INTERVIEW (Candidate)
// PUT /api/v1/interviews/:id/start
// =============================================
export const startInterview = asyncHandler(async (req, res, next) => {
  const interview = await InterviewAssignment.findById(req.params.id);

  if (!interview) {
    return res.status(404).json({ success: false, message: 'Interview not found' });
  }

  if (interview.candidate.toString() !== req.user._id.toString()) {
    return res.status(403).json({ success: false, message: 'This interview is not assigned to you' });
  }

  if (interview.status !== 'pending') {
    return res.status(400).json({ success: false, message: 'Interview can only be started from pending status' });
  }

  interview.status = 'in-progress';
  interview.startedAt = new Date();
  await interview.save();

  // Return only the questions (no answers/report yet)
  res.status(200).json({
    success: true,
    message: 'Interview started',
    data: {
      id: interview._id,
      jobRole: interview.jobRole,
      questions: interview.questions,
      startedAt: interview.startedAt,
    },
  });
});

// =============================================
// SUBMIT ANSWER (Candidate)
// PUT /api/v1/interviews/:id/answer
// =============================================
export const submitAnswer = asyncHandler(async (req, res, next) => {
  const { questionId, answer } = req.body;
  const interview = await InterviewAssignment.findById(req.params.id);

  if (!interview) {
    return res.status(404).json({ success: false, message: 'Interview not found' });
  }

  if (interview.candidate.toString() !== req.user._id.toString()) {
    return res.status(403).json({ success: false, message: 'Not authorized' });
  }

  if (interview.status !== 'in-progress') {
    return res.status(400).json({ success: false, message: 'Interview is not in progress' });
  }

  if (!answer || answer.trim().length < 10) {
    return res.status(400).json({ success: false, message: 'Answer must be at least 10 characters' });
  }

  const question = interview.questions.find(q => q.id === questionId);
  if (!question) {
    return res.status(404).json({ success: false, message: 'Question not found' });
  }

  // Evaluate answer using AI
  const prompt = `You are a professional interviewer evaluating a candidate's answer.

Question: "${question.question}"
Candidate's Answer: "${answer}"

Evaluate the answer based on:
1. Relevance to the question
2. Clarity and structure
3. Depth of knowledge shown
4. Use of specific examples

Return ONLY valid JSON (no markdown, no extra text):
{
  "score": number (1-100),
  "feedback": "2-3 sentence constructive feedback",
  "strength": "one key strength",
  "improvement": "one specific area to improve"
}

Be fair and constructive. Score should be 1-100 range. Score 0-10 for "I don't know" or completely irrelevant answers.`;

  let evaluation = {
    score: 50,
    feedback: 'Your answer shows understanding. Consider adding more specific examples.',
    strength: 'Good response',
    improvement: 'Add more details',
  };

  try {
    const openai = getOpenAIClient();
    const response = await openai.chat.completions.create({
      model: 'openai/gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'You are an expert interviewer evaluating answers. Return ONLY valid JSON.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 600,
    });

    const content = response.choices[0]?.message?.content || '';
    const cleaned = content.replace(/```(?:json)?\s*/gi, '').trim();
    evaluation = JSON.parse(cleaned);
  } catch (err) {
    console.error('AI evaluation failed, using fallback:', err.message);
  }

  // Remove previous answer for same question if exists
  interview.answers = interview.answers.filter(a => a.questionId !== questionId);

  interview.answers.push({
    questionId,
    question: question.question,
    answer,
    score: evaluation.score,
    feedback: evaluation.feedback,
    strength: evaluation.strength,
    improvement: evaluation.improvement,
  });

  await interview.save();

  const isComplete = interview.answers.length >= interview.questions.length;

  res.status(200).json({
    success: true,
    data: {
      evaluation,
      isComplete,
      answeredCount: interview.answers.length,
      totalQuestions: interview.questions.length,
    },
  });
});

// =============================================
// COMPLETE INTERVIEW & GENERATE REPORT
// PUT /api/v1/interviews/:id/complete
// =============================================
export const completeInterview = asyncHandler(async (req, res, next) => {
  const interview = await InterviewAssignment.findById(req.params.id);

  if (!interview) {
    return res.status(404).json({ success: false, message: 'Interview not found' });
  }

  if (interview.candidate.toString() !== req.user._id.toString()) {
    return res.status(403).json({ success: false, message: 'Not authorized' });
  }

  if (interview.status !== 'in-progress') {
    return res.status(400).json({ success: false, message: 'Interview is not in progress' });
  }

  if (interview.answers.length < interview.questions.length) {
    return res.status(400).json({
      success: false,
      message: `Please answer all questions first (${interview.answers.length}/${interview.questions.length})`,
    });
  }

  const totalScore = Math.round(
    interview.answers.reduce((sum, a) => sum + a.score, 0) / interview.answers.length
  );

  const qaText = interview.answers.map((a, i) =>
    `Q${i + 1}: ${a.question}\nAnswer: ${a.answer}\nScore: ${a.score}\nFeedback: ${a.feedback}`
  ).join('\n\n');

  const prompt = `You are a senior hiring manager reviewing a candidate's interview performance.

Role: ${interview.jobRole}

Interview Transcript with Scores:
${qaText}

Overall Average Score: ${totalScore}%

Return ONLY valid JSON (no markdown, no extra text):
{
  "summary": "2-3 sentence overall assessment",
  "strengths": ["strength1", "strength2", "strength3"],
  "areasForImprovement": ["area1", "area2", "area3"],
  "detailedFeedback": [
    { "questionNumber": 1, "feedback": "brief feedback on this answer" },
    { "questionNumber": 2, "feedback": "..." },
    { "questionNumber": 3, "feedback": "..." },
    { "questionNumber": 4, "feedback": "..." },
    { "questionNumber": 5, "feedback": "..." },
    { "questionNumber": 6, "feedback": "..." }
  ],
  "recommendation": "Strong Hire" | "Hire" | "Consider" | "No Hire",
  "suggestedRoles": ["role1", "role2"]
}`;

  let report = {
    summary: 'The candidate provided reasonable answers across all questions.',
    strengths: ['Good communication', 'Relevant experience', 'Professional attitude'],
    areasForImprovement: ['Provide more technical depth', 'Use more specific examples'],
    detailedFeedback: interview.answers.map((a, i) => ({
      questionNumber: i + 1,
      feedback: a.feedback,
    })),
    recommendation: totalScore >= 80 ? 'Strong Hire' : totalScore >= 65 ? 'Hire' : totalScore >= 50 ? 'Consider' : 'No Hire',
    suggestedRoles: [interview.jobRole],
  };

  try {
    const openai = getOpenAIClient();
    const response = await openai.chat.completions.create({
      model: 'openai/gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'You are a senior hiring manager generating interview reports. Return ONLY valid JSON.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 2000,
    });

    const content = response.choices[0]?.message?.content || '';
    const cleaned = content.replace(/```(?:json)?\s*/gi, '').trim();
    report = JSON.parse(cleaned);
  } catch (err) {
    console.error('AI report generation failed, using fallback:', err.message);
  }

  interview.report = {
    ...report,
    overallScore: totalScore,
    completedAt: new Date(),
  };
  interview.status = 'completed';
  interview.completedAt = new Date();
  await interview.save();

  // Update application status to 'interviewed'
  const job = await Job.findById(interview.job);
  if (job) {
    const application = job.applications.find(
      app => app.candidate.toString() === interview.candidate.toString()
    );
    if (application) {
      application.status = 'interviewed';
      application.score = totalScore;
      await job.save({ validateBeforeSave: false });
    }
  }

  // Send email notifications
  try {
    const candidate = await User.findById(interview.candidate).select('fullName email');
    const recruiter = await User.findById(interview.recruiter).select('fullName email');
    const company = job?.company || '';

    if (candidate) {
      await sendInterviewReportEmail(
        candidate.email,
        candidate.fullName,
        interview.jobRole,
        company,
        totalScore,
        interview.report?.recommendation
      );
    }

    if (recruiter) {
      await sendInterviewReportEmail(
        recruiter.email,
        recruiter.fullName,
        interview.jobRole,
        company,
        totalScore,
        interview.report?.recommendation
      );
    }
  } catch (emailErr) {
    console.error('Failed to send interview report email:', emailErr.message);
  }

  res.status(200).json({
    success: true,
    message: 'Interview completed',
    data: { report: interview.report },
  });
});

// =============================================
// CANCEL INTERVIEW (Recruiter)
// PUT /api/v1/interviews/:id/cancel
// =============================================
export const cancelInterview = asyncHandler(async (req, res, next) => {
  const interview = await InterviewAssignment.findById(req.params.id);

  if (!interview) {
    return res.status(404).json({ success: false, message: 'Interview not found' });
  }

  if (interview.recruiter.toString() !== req.user._id.toString()) {
    return res.status(403).json({ success: false, message: 'Not authorized' });
  }

  if (interview.status === 'completed') {
    return res.status(400).json({ success: false, message: 'Cannot cancel a completed interview' });
  }

  interview.status = 'cancelled';
  await interview.save();

  res.status(200).json({
    success: true,
    message: 'Interview cancelled',
  });
});

// =============================================
// DELETE INTERVIEW (Recruiter or Candidate)
// DELETE /api/v1/interviews/:id
// =============================================
export const deleteInterview = asyncHandler(async (req, res, next) => {
  const interview = await InterviewAssignment.findById(req.params.id);

  if (!interview) {
    return res.status(404).json({ success: false, message: 'Interview not found' });
  }

  // Allow if user is the recruiter who assigned OR the candidate who owns it
  const isRecruiter = interview.recruiter.toString() === req.user._id.toString();
  const isCandidate = interview.candidate.toString() === req.user._id.toString();

  if (!isRecruiter && !isCandidate) {
    return res.status(403).json({ success: false, message: 'Not authorized to delete this interview' });
  }

  await interview.deleteOne();

  res.status(200).json({
    success: true,
    message: 'Interview deleted successfully',
  });
});
