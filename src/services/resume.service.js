import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');
import mammoth from 'mammoth';
import fs from 'fs';

// const anthropic = new Anthropic({
//   apiKey: process.env.ANTHROPIC_API_KEY,
// });

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
      return "Mock text for unsupported file type";
    }
  } catch (error) {
    console.error('Extraction Error (Mock Mode):', error);
    return "Sample extracted text for analysis";
  }
};

/**
 * MOCK ANALYSIS SERVICE
 * This function returns realistic data for testing without API costs.
 * Swap this with the real analyzeResumeWithAI logic when ready.
 */
const getMockAnalysis = (resumeText) => {
  return {
    overallScore: 82,
    atsScore: 78,
    atsFeedback: "Your resume has a strong structure and clear section headings. However, incorporating more industry-specific keywords could improve your ranking in automated systems.",
    sections: {
      contactInfo: { score: 95, feedback: "All contact details (email, phone, LinkedIn) are present and clear." },
      summary: { score: 85, feedback: "Concise and impact-driven professional summary." },
      experience: { score: 75, feedback: "Great use of action verbs, but could benefit from more quantifiable achievements (e.g., '%' or '$')." },
      education: { score: 90, feedback: "Clear and correctly formatted education history." },
      skills: { score: 80, feedback: "Relevant technical skills found, but consider categorizing them by proficiency." },
      formatting: { score: 88, feedback: "Clean layout with good white space management. Font choices are professional." }
    },
    extractedSkills: ["React.js", "Node.js", "Express", "MongoDB", "AWS", "Docker", "REST APIs", "Git"],
    suggestedJobRoles: ["Senior Frontend Developer", "Full Stack Engineer", "Web Applications Architect"],
    strengthPoints: [
      "Strong technical stack alignment",
      "Clear professional progression",
      "Excellent formatting and readability",
      "Comprehensive contact information"
    ],
    improvementAreas: [
      "Add more metrics/quantifiable results in experience section",
      "Include a portfolio link if applicable",
      "Optimize keywords for 'Cloud Architecture' roles",
      "Standardize date formats throughout the document"
    ],
    keywordsFound: ["JavaScript", "Frontend", "Backend", "API", "Database", "Scalability"],
    missingKeywords: ["TypeScript", "GraphQL", "Kubernetes", "CI/CD Pipeline"]
  };
};

export const analyzeResumeWithAI = async (resumeText) => {
  // Simulate a slight delay to mimic AI processing
  await new Promise(resolve => setTimeout(resolve, 2500));

  console.log("--- RUNNING IN MOCK MODE ---");
  return getMockAnalysis(resumeText);

  /* 
  // REAL AI IMPLEMENTATION (Uncomment when API Key is available)
  try {
    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20240620",
      max_tokens: 4000,
      temperature: 0.2,
      system: "You are an expert HR and ATS specialist...",
      messages: [{ role: "user", content: `Analyze this resume...` }],
    });
    // ... parsing logic ...
  } catch (error) {
    // ... error handling ...
  }
  */
};
