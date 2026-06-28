import Conversation from '../models/conversation.model.js';
import Message from '../models/message.model.js';

export const getConversations = async (req, res) => {
  try {
    const conversations = await Conversation.find({
      participants: req.user._id,
    })
      .populate('participants', 'fullName email avatar role company bio')
      .sort({ 'lastMessage.timestamp': -1, updatedAt: -1 })
      .lean();

    const enriched = await Promise.all(conversations.map(async (conv) => {
      const unreadCount = await Message.countDocuments({
        conversation: conv._id,
        sender: { $ne: req.user._id },
        readAt: null,
      });
      return { ...conv, unreadCount };
    }));

    res.json({ success: true, data: enriched });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getOrCreateConversation = async (req, res) => {
  try {
    const { recipientId } = req.params;
    if (recipientId === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'Cannot message yourself' });
    }

    let conversation = await Conversation.findOne({
      participants: { $all: [req.user._id, recipientId], $size: 2 },
    }).populate('participants', 'fullName email avatar role company bio');

    if (!conversation) {
      conversation = await Conversation.create({
        participants: [req.user._id, recipientId],
      });
      conversation = await conversation.populate('participants', 'fullName email avatar role company bio');
    }

    const unreadCount = await Message.countDocuments({
      conversation: conversation._id,
      sender: { $ne: req.user._id },
      readAt: null,
    });

    res.json({ success: true, data: { ...conversation.toObject(), unreadCount } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getMessages = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const conversation = await Conversation.findOne({
      _id: id,
      participants: req.user._id,
    });
    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const messages = await Message.find({ conversation: id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('sender', 'fullName avatar role')
      .lean();

    const total = await Message.countDocuments({ conversation: id });

    res.json({
      success: true,
      data: messages.reverse(),
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { text, type, file } = req.body;

    if (!text?.trim() && type !== 'image' && type !== 'video' && type !== 'sticker') {
      return res.status(400).json({ success: false, message: 'Message content is required' });
    }

    const conversation = await Conversation.findOne({
      _id: id,
      participants: req.user._id,
    });
    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    const msgType = type || 'text';
    const msgData = {
      conversation: id,
      sender: req.user._id,
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
      sender: req.user._id,
      timestamp: new Date(),
    };
    await conversation.save();

    const populated = await message.populate('sender', 'fullName avatar role');

    const recipientId = conversation.participants.find(
      p => p.toString() !== req.user._id.toString()
    );

    if (req.app.get('io')) {
      const io = req.app.get('io');
      io.to(`conv_${id}`).emit('new_message', populated.toObject());
      io.to(`user_${recipientId}`).emit('conversation_updated', {
        conversationId: id,
        lastMessage: conversation.lastMessage,
      });
    }

    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    const url = `/uploads/chat/${req.file.filename}`;
    res.json({
      success: true,
      data: { url, name: req.file.originalname, size: req.file.size, mime: req.file.mimetype },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const clearChat = async (req, res) => {
  try {
    const { id } = req.params;
    const conversation = await Conversation.findOne({
      _id: id,
      participants: req.user._id,
    });
    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    await Message.deleteMany({ conversation: id });

    conversation.lastMessage = null;
    await conversation.save();

    if (req.app.get('io')) {
      const io = req.app.get('io');
      io.to(`conv_${id}`).emit('chat_cleared', { conversationId: id });
    }

    res.json({ success: true, message: 'Chat cleared' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteConversation = async (req, res) => {
  try {
    const { id } = req.params;
    const conversation = await Conversation.findOne({
      _id: id,
      participants: req.user._id,
    });
    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    await Message.deleteMany({ conversation: id });
    const io = req.app.get('io');
    const otherId = conversation.participants.find(p => p.toString() !== req.user._id.toString());
    await Conversation.findByIdAndDelete(id);

    if (io) {
      if (otherId) {
        io.to(`user_${otherId}`).emit('conversation_deleted', { conversationId: id });
      }
    }

    res.json({ success: true, message: 'Conversation deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    const conversation = await Conversation.findOne({
      _id: id,
      participants: req.user._id,
    });
    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    await Message.updateMany(
      { conversation: id, sender: { $ne: req.user._id }, readAt: null },
      { readAt: new Date() }
    );

    res.json({ success: true, message: 'Messages marked as read' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
