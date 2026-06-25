import express from 'express';
import { testOpenRouter, chatWithAI, generateInterviewQuestions, evaluateAnswer, generateInterviewReport } from '../controllers/ai.controller.js';

const router = express.Router();

router.get('/test', testOpenRouter);
router.post('/chat', chatWithAI);

// Interview routes
router.post('/interview/generate-questions', generateInterviewQuestions);
router.post('/interview/evaluate-answer', evaluateAnswer);
router.post('/interview/generate-report', generateInterviewReport);

export default router;
