import express from 'express';
import { testOpenRouter, chatWithAI } from '../controllers/ai.controller.js';

const router = express.Router();

router.get('/test', testOpenRouter);
router.post('/chat', chatWithAI);

export default router;
