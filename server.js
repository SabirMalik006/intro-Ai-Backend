import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import express from 'express';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

import app from './src/app.js';
import { connectDB } from './src/config/database.js';
import Conversation from './src/models/conversation.model.js';
import Message from './src/models/message.model.js';

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const PORT = process.env.PORT || 5000;
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST'],
  },
  maxHttpBufferSize: 1e7, // 10MB max message size
  pingTimeout: 60000,
  pingInterval: 25000,
});

app.set('io', io);

io.use((socket, next) => {
  const token = socket.handshake.auth?.token
    || socket.handshake.query?.token
    || extractCookie(socket.handshake.headers?.cookie, 'accessToken');
  if (!token) return next(new Error('Authentication required'));

  try {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    socket.userId = decoded.id;
    next();
  } catch {
    next(new Error('Invalid token'));
  }
});

function extractCookie(cookieString, name) {
  if (!cookieString) return null;
  const match = cookieString.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? match[1] : null;
}

io.on('connection', (socket) => {
  console.log(`🔌 User ${socket.userId} connected`);

  socket.join(`user_${socket.userId}`);

  socket.on('join_conversation', (conversationId) => {
    socket.join(`conv_${conversationId}`);
  });

  socket.on('leave_conversation', (conversationId) => {
    socket.leave(`conv_${conversationId}`);
  });

  socket.on('send_message', async (data, callback) => {
    try {
      const { conversationId, text, type, file } = data;
      const msgType = type || 'text';

      if (!text?.trim() && msgType !== 'image' && msgType !== 'video' && msgType !== 'sticker') {
        return callback?.({ error: 'Message content is required' });
      }

      const conversation = await Conversation.findOne({
        _id: conversationId,
        participants: socket.userId,
      });
      if (!conversation) return callback?.({ error: 'Conversation not found' });

      const msgData = {
        conversation: conversationId,
        sender: socket.userId,
        type: msgType,
        text: text?.trim() || '',
      };
      if (file?.url) msgData.file = { url: file.url, name: file.name, size: file.size, mime: file.mime };

      const message = await Message.create(msgData);

      const lastText = msgType === 'sticker' ? '😊 Sticker'
        : msgType === 'image' ? '📷 Photo'
        : msgType === 'video' ? '🎥 Video'
        : text?.trim() || '';

      conversation.lastMessage = {
        text: lastText,
        sender: socket.userId,
        timestamp: new Date(),
      };
      await conversation.save();

      const populated = await message.populate('sender', 'fullName avatar role');

      io.to(`conv_${conversationId}`).emit('new_message', populated.toObject());

      const recipientId = conversation.participants.find(
        p => p.toString() !== socket.userId
      );
      if (recipientId) {
        io.to(`user_${recipientId}`).emit('conversation_updated', {
          conversationId,
          lastMessage: conversation.lastMessage,
        });
      }

      callback?.({ success: true, data: populated });
    } catch (error) {
      callback?.({ error: error.message });
    }
  });

  socket.on('mark_read', async (conversationId) => {
    try {
      await Message.updateMany(
        { conversation: conversationId, sender: { $ne: socket.userId }, readAt: null },
        { readAt: new Date() }
      );
      io.to(`conv_${conversationId}`).emit('messages_read', { conversationId, userId: socket.userId });
    } catch { /* ignore */ }
  });

  socket.on('disconnect', () => {
    console.log(`🔌 User ${socket.userId} disconnected`);
  });
});

connectDB()
  .then(() => {
    httpServer.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`📍 API: http://localhost:${PORT}/api/v1`);
      console.log(`❤️  Health: http://localhost:${PORT}/api/health`);
      console.log(`💬 Socket.io ready`);
    });
  })
  .catch((err) => {
    console.error('❌ Failed to connect to database:', err.message);
    process.exit(1);
  });
