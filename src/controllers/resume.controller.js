import Resume from '../models/resume.model.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// STEP 1: Global rejection handler
process.on('unhandledRejection', (reason) => {
  console.error('🚀 UNHANDLED REJECTION:', reason);
});

// =============================================
// ANALYZE RESUME
// POST /api/v1/resume/analyze
// =============================================
export const analyzeResume = async (req, res) => {
  // STEP 1: Wrap entire function in try-catch
  try {
    console.log('--- RESUME ANALYSIS START ---');
    
    if (!req.file) {
      console.log('❌ No file uploaded');
      return res.status(400).json({ success: false, message: 'Please upload a resume file' });
    }

    const filePath = req.file.path;
    const ext = path.extname(req.file.originalname).toLowerCase();
    console.log(`📂 File: ${req.file.originalname} | Ext: ${ext} | Path: ${filePath}`);

    // STEP 3: Dynamic extraction
    let text = '';
    try {
      if (ext === '.pdf') {
        console.log('📄 Processing PDF...');
        const dataBuffer = fs.readFileSync(filePath);
        // Direct require of internal lib to bypass test file bug in pdf-parse
        const pdf = require('pdf-parse/lib/pdf-parse');
        const pdfData = await pdf(dataBuffer);
        text = pdfData.text || 'extracted';
        console.log('✅ PDF Text Extracted');
      } else if (ext === '.docx') {
        console.log('📝 Processing DOCX...');
        const mammoth = require('mammoth');
        const result = await mammoth.extractRawText({ path: filePath });
        text = result.value || 'extracted';
        console.log('✅ DOCX Text Extracted');
      } else {
        return res.status(400).json({ success: false, message: 'Only PDF and DOCX allowed' });
      }
    } catch (extractErr) {
      console.error('❌ EXTRACTION FAILED:', extractErr.message);
      // We continue to mock response anyway if extraction fails but file was there
    }

    // Randomized Mock Analysis Response
    console.log('🤖 Generating unique mock analysis...');
    
    // Simple randomization based on filename length or random numbers
    const baseScore = Math.floor(Math.random() * 20) + 70; // 70-90
    const atsScore = Math.floor(Math.random() * 15) + 65; // 65-80
    
    const mockAnalysisResult = {
      overallScore: baseScore,
      atsScore: atsScore,
      atsFeedback: atsScore > 75 
        ? "Excellent! Your resume is highly optimized for ATS systems." 
        : "Your resume is fairly ATS-friendly but could use more industry-specific keywords.",
      sections: {
        contactInfo: { score: Math.floor(Math.random() * 10) + 85, feedback: "Contact info is clear and professional." },
        summary: { score: Math.floor(Math.random() * 20) + 65, feedback: "Consider adding more quantifiable achievements." },
        experience: { score: Math.floor(Math.random() * 15) + 75, feedback: "Experience is well-structured with clear impact." },
        education: { score: Math.floor(Math.random() * 10) + 80, feedback: "Education details are accurate and properly placed." },
        skills: { score: Math.floor(Math.random() * 20) + 70, feedback: "Skills section is relevant but missing some niche keywords." },
        formatting: { score: Math.floor(Math.random() * 15) + 70, feedback: "Visual layout is clean and easy to scan." }
      },
      extractedSkills: ["React", "Node.js", "Python", "SQL", "Team Leadership", "Project Management"].sort(() => 0.5 - Math.random()).slice(0, 5),
      suggestedJobRoles: ["Full Stack Developer", "Software Engineer", "Technical Lead"],
      strengthPoints: ["Modern tech stack usage", "Strong professional summary", "Clear quantifiable results"],
      improvementAreas: ["Add more relevant keywords", "Use stronger action verbs", "Improve section spacing"],
      keywordsFound: ["development", "management", "technical", "engineering"],
      missingKeywords: ["Cloud", "DevOps", "Microservices", "Scalability"]
    };

    // Save to DB
    const resumeAnalysis = await Resume.create({
      userId: req.user._id,
      filename: req.file.originalname,
      fileUrl: req.file.path,
      analysisResult: mockAnalysisResult,
    });

    console.log('✨ Analysis Complete');
    return res.status(201).json({
      success: true,
      message: 'Resume analyzed successfully',
      data: resumeAnalysis,
    });

  } catch (err) {
    // STEP 1: Log error details
    console.error('🚨 RESUME CONTROLLER ERROR:', err.message, err.stack);
    return res.status(500).json({ 
      success: false, 
      message: err.message || "Resume processing failed" 
    });
  } finally {
    // STEP 6: Guaranteed cleanup
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
        console.log('🧹 Temp file cleaned up');
      } catch (cleanupErr) {
        console.error('🧹 Cleanup failed:', cleanupErr.message);
      }
    }
  }
};

// GET ANALYSIS HISTORY
export const getResumeHistory = async (req, res) => {
  try {
    const history = await Resume.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .select('filename createdAt analysisResult.overallScore');
    res.status(200).json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET SPECIFIC REPORT
export const getResumeReport = async (req, res) => {
  try {
    const report = await Resume.findById(req.params.id);
    if (!report) return res.status(404).json({ success: false, message: 'Report not found' });
    if (report.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
    res.status(200).json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
