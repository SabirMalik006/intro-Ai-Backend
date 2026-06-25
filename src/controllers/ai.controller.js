import OpenAI from 'openai';
import asyncHandler from '../utils/asyncHandler.js';

const getOpenAIClient = () => {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY is missing in environment variables');
  }
  return new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
    defaultHeaders: {
      "HTTP-Referer": "http://localhost:3000",
      "X-Title": "SmartHire",
    }
  });
};

export const testOpenRouter = asyncHandler(async (req, res) => {
  res.json({ success: true, message: 'OpenRouter is configured' });
});

export const chatWithAI = asyncHandler(async (req, res) => {
  const { messages } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({
      success: false,
      message: 'Messages array is required',
    });
  }

  const optimizedMessages = messages.slice(-6);

  const systemPrompt = {
    role: 'system',
    content: `You are the official SmartHire AI Assistant. Your goal is to help users navigate and understand the SmartHire platform.
    
    About SmartHire:
    - SmartHire is an AI-powered recruitment platform.
    - Features: Resume analysis, job matching, automated interview scheduling, and AI-driven candidate ranking.
    - For Candidates: It helps in optimizing resumes and finding the best-matched jobs.
    - For Recruiters: It simplifies hiring by ranking candidates using AI.
    
    Rules:
    1. ONLY answer questions related to SmartHire, job hunting, recruitment, or career advice.
    2. If a user asks about anything else (e.g., weather, cooking, other companies), politely redirect them to SmartHire related topics.
    3. Keep responses concise, professional, and helpful.
    4. Use emojis occasionally to be friendly.
    5. Language: Answer in the same language the user uses (English or Urdu/Roman Urdu).`
  };

  const openai = getOpenAIClient();

  try {
    const response = await openai.chat.completions.create({
      model: 'openai/gpt-3.5-turbo',
      messages: [systemPrompt, ...optimizedMessages],
      temperature: 0.7,
      max_tokens: 500,
    });

    res.status(200).json({
      success: true,
      data: response.choices[0].message,
    });
  } catch (error) {
    console.error('Chat AI Error:', error);
    res.status(500).json({
      success: false,
      message: 'Chat assistant failed',
      error: error.message,
    });
  }
});

// ─────────────────────────────────────────────
// INTERVIEW CONTROLLERS
// ─────────────────────────────────────────────

export const generateInterviewQuestions = asyncHandler(async (req, res) => {
  const { jobRole, jobDescription, skills } = req.body;

  if (!jobRole) {
    return res.status(400).json({ success: false, message: 'Job role is required' });
  }

  const skillText = skills?.length ? skills.join(', ') : 'relevant professional skills';

  const prompt = `You are a technical interviewer at SmartHire. Generate exactly 6 interview questions for the role of "${jobRole}".

Job Description: ${jobDescription || 'N/A'}
Candidate Skills: ${skillText}

Return ONLY a valid JSON array (no markdown, no extra text) with exactly 6 objects, each containing:
{
  "id": number (1-6),
  "question": "string",
  "category": "Technical" | "Behavioral" | "Situational" | "Experience"
}

Mix technical and behavioral questions appropriately for this role.`;

  const openai = getOpenAIClient();

  try {
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
    const questions = JSON.parse(cleaned);

    if (!Array.isArray(questions) || questions.length !== 6) {
      throw new Error('Invalid questions format');
    }

    res.status(200).json({ success: true, data: questions });
  } catch (error) {
    console.error('Generate Questions Error:', error);
    // Fallback questions if AI fails
    const fallback = [
      { id: 1, question: `Tell me about your experience with ${skillText} and how it applies to the ${jobRole} role.`, category: 'Experience' },
      { id: 2, question: 'Describe a challenging project you worked on and how you overcame obstacles.', category: 'Behavioral' },
      { id: 3, question: `What technical skills do you consider most important for a ${jobRole} and why?`, category: 'Technical' },
      { id: 4, question: 'How do you stay updated with industry trends and new technologies?', category: 'Behavioral' },
      { id: 5, question: 'Tell me about a time you had to work under pressure to meet a tight deadline.', category: 'Situational' },
      { id: 6, question: 'Where do you see yourself professionally in the next 3-5 years?', category: 'Experience' },
    ];
    res.status(200).json({ success: true, data: fallback });
  }
});

export const evaluateAnswer = asyncHandler(async (req, res) => {
  const { question, answer, questionNumber, totalQuestions } = req.body;

  if (!question || !answer) {
    return res.status(400).json({ success: false, message: 'Question and answer are required' });
  }

  if (answer.trim().length < 10) {
    return res.status(400).json({ success: false, message: 'Answer is too short. Please provide a detailed response (at least 10 characters).' });
  }

  if (answer.trim().length > 3000) {
    return res.status(400).json({ success: false, message: 'Answer is too long. Please keep it under 3000 characters.' });
  }

  const prompt = `You are a professional interviewer evaluating a candidate's answer.

Question: "${question}"
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

Be fair and constructive. Score should be 40-95 range.`;

  const openai = getOpenAIClient();

  try {
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
    const evaluation = JSON.parse(cleaned);

    res.status(200).json({
      success: true,
      data: {
        ...evaluation,
        isComplete: questionNumber >= totalQuestions,
      }
    });
  } catch (error) {
    console.error('Evaluate Answer Error:', error);
    res.status(200).json({
      success: true,
      data: {
        score: 70,
        feedback: 'Your answer shows understanding of the topic. Consider adding more specific examples from your experience to strengthen your response.',
        strength: 'Good overall response',
        improvement: 'Add more specific examples',
        isComplete: questionNumber >= totalQuestions,
      }
    });
  }
});

export const generateInterviewReport = asyncHandler(async (req, res) => {
  const { answers, jobRole } = req.body;

  if (!answers || !Array.isArray(answers) || answers.length === 0) {
    return res.status(400).json({ success: false, message: 'Answers array is required' });
  }

  const qaText = answers.map((a, i) =>
    `Q${i + 1}: ${a.question}\nAnswer: ${a.answer}\nScore: ${a.score}\nFeedback: ${a.feedback}`
  ).join('\n\n');

  const totalScore = Math.round(answers.reduce((sum, a) => sum + a.score, 0) / answers.length);

  const prompt = `You are a senior hiring manager reviewing a candidate's interview performance.

Role: ${jobRole || 'Unknown'}

Interview Transcript with Scores:
${qaText}

Overall Average Score: ${totalScore}%

Return ONLY valid JSON (no markdown, no extra text):
{
  "overallScore": number (average score),
  "summary": "2-3 sentence overall assessment",
  "strengths": ["strength1", "strength2", "strength3"],
  "areasForImprovement": ["area1", "area2", "area2"],
  "detailedFeedback": [
    { "questionNumber": 1, "feedback": "brief feedback on this answer" },
    { "questionNumber": 2, "feedback": "..." }
  ],
  "recommendation": "Strong Hire" | "Hire" | "Consider" | "No Hire",
  "suggestedRoles": ["role1", "role2"]
}`;

  const openai = getOpenAIClient();

  try {
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
    const report = JSON.parse(cleaned);

    res.status(200).json({
      success: true,
      data: {
        ...report,
        overallScore: totalScore,
        totalQuestions: answers.length,
        date: new Date().toISOString(),
      }
    });
  } catch (error) {
    console.error('Generate Report Error:', error);
    res.status(200).json({
      success: true,
      data: {
        overallScore: totalScore,
        summary: 'The candidate provided reasonable answers across all questions. There is good potential but some areas need development.',
        strengths: ['Good communication', 'Relevant experience', 'Professional attitude'],
        areasForImprovement: ['Provide more technical depth', 'Use more specific examples', 'Structure answers more clearly'],
        detailedFeedback: answers.map((a, i) => ({
          questionNumber: i + 1,
          feedback: a.feedback || 'Good attempt on this question.',
        })),
        recommendation: totalScore >= 80 ? 'Strong Hire' : totalScore >= 65 ? 'Hire' : totalScore >= 50 ? 'Consider' : 'No Hire',
        suggestedRoles: [jobRole || 'Relevant Position'],
        totalQuestions: answers.length,
        date: new Date().toISOString(),
      }
    });
  }
});
