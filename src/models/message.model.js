import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  conversation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true,
    index: true,
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  type: {
    type: String,
    enum: ['text', 'image', 'video', 'sticker'],
    default: 'text',
  },
  text: {
    type: String,
    trim: true,
    maxlength: 5000,
    default: '',
  },
  file: {
    url: String,
    name: String,
    size: Number,
    mime: String,
  },
  readAt: Date,
}, { timestamps: true });

export default mongoose.model('Message', messageSchema);
