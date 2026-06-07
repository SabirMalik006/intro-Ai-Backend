import OpenAI from 'openai';
import asyncHandler from '../utils/asyncHandler.js';

// Getter for OpenAI client to ensure env vars are loaded
const getOpenAIClient = () => {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY is missing in environment variables');
  }
  return new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
    defaultHeaders: {
      "HTTP-Referer": "http://localhost:3000", // Optional, for OpenRouter rankings
      "X-Title": "SmartHire", // Optional, for OpenRouter rankings
    }
  });
};

export const testOpenRouter = asyncHandler(async (req, res) => {
  // ... (keeping existing testOpenRouter)
});

export const chatWithAI = asyncHandler(async (req, res) => {
  const { messages } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({
      success: false,
      message: 'Messages array is required',
    });
  }

  // Keep only the last 6 messages to optimize tokens
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
      model: 'openai/gpt-3.5-turbo', // Using gpt-3.5-turbo for speed and cost-effectiveness
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
