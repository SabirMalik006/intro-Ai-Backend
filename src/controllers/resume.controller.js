import Resume from '../models/resume.model.js';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { analyzeResumeWithAI } from '../services/resume.service.js';

const require = createRequire(import.meta.url);

export const analyzeResume = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please upload a resume file' });
    }

    const filePath = req.file.path;
    const ext = path.extname(req.file.originalname).toLowerCase();

    let text = '';
    try {
      if (ext === '.pdf') {
        const dataBuffer = fs.readFileSync(filePath);
        const pdf = require('pdf-parse/lib/pdf-parse');
        const pdfData = await pdf(dataBuffer);
        text = pdfData.text || '';
      } else if (ext === '.docx') {
        const mammoth = require('mammoth');
        const result = await mammoth.extractRawText({ path: filePath });
        text = result.value || '';
      } else {
        return res.status(400).json({ success: false, message: 'Only PDF and DOCX allowed' });
      }
    } catch (extractErr) {
      console.error('Text extraction failed:', extractErr.message);
    }

    if (!text.trim()) {
      return res.status(400).json({ success: false, message: 'Could not extract text from resume' });
    }

    const analysisResult = await analyzeResumeWithAI(text);

    const resumeAnalysis = await Resume.create({
      userId: req.user._id,
      filename: req.file.originalname,
      fileUrl: req.file.path,
      analysisResult,
    });

    return res.status(201).json({
      success: true,
      message: 'Resume analyzed successfully',
      data: resumeAnalysis,
    });

  } catch (err) {
    console.error('Resume controller error:', err.message);
    return res.status(500).json({
      success: false,
      message: err.message || 'Resume processing failed',
    });
  } finally {
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupErr) {
        console.error('Cleanup failed:', cleanupErr.message);
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
