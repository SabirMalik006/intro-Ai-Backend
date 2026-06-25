import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');
import mammoth from 'mammoth';
import fs from 'fs';
import OpenAI from 'openai';

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

export const extractTextFromFile = async (filePath, mimetype) => {
  try {
    const dataBuffer = fs.readFileSync(filePath);

    if (mimetype === 'application/pdf') {
      const data = await pdf(dataBuffer);
      return data.text;
    } else if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const data = await mammoth.extractRawText({ buffer: dataBuffer });
      return data.value;
    } else {
      return "";
    }
  } catch (error) {
    console.error('Extraction Error:', error);
    return "";
  }
};

const SYSTEM_PROMPT = `You are an expert ATS resume analyzer. Analyze the resume text and return ONLY valid JSON with this exact structure (no markdown, no extra text):
{
  "overallScore": number (0-100),
  "atsScore": number (0-100),
  "atsFeedback": "string",
  "sections": {
    "contactInfo": { "score": number, "feedback": "string" },
    "summary": { "score": number, "feedback": "string" },
    "experience": { "score": number, "feedback": "string" },
    "education": { "score": number, "feedback": "string" },
    "skills": { "score": number, "feedback": "string" },
    "formatting": { "score": number, "feedback": "string" }
  },
  "extractedSkills": ["skill1", "skill2", ...],
  "suggestedJobRoles": ["role1", "role2", ...],
  "strengthPoints": ["point1", "point2", ...],
  "improvementAreas": ["area1", "area2", ...],
  "keywordsFound": ["keyword1", ...],
  "missingKeywords": ["keyword1", ...]
}

Be fair and constructive. Scores should vary based on actual resume quality.`;

const MAX_RESUME_CHARS = 8000;

export const analyzeResumeWithAI = async (resumeText) => {
  try {
    const openai = getOpenAIClient();
    const trimmedText = resumeText.slice(0, MAX_RESUME_CHARS);

    const response = await openai.chat.completions.create({
      model: 'openai/gpt-3.5-turbo',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Analyze this resume:\n\n${trimmedText}` }
      ],
      temperature: 0.2,
      max_tokens: 2000,
    });

    const content = response.choices[0]?.message?.content || '';
    const cleaned = content.replace(/```(?:json)?\s*/gi, '').trim();
    return JSON.parse(cleaned);

  } catch (error) {
    console.error('AI Resume Analysis Error:', error);
    throw new Error('AI analysis failed. Please try again.');
  }
};
