const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  role: { type: String, enum: ['user', 'assistant'], required: true },
  content: { type: String, required: true },
  disease: String, // Track disease for context
  context: {
    patientName: String,
    disease: String,
    additionalQuery: String,
    location: String,
  },
  response: mongoose.Schema.Types.Mixed, // Store full response for context
  timestamp: { type: Date, default: Date.now },
});

const conversationSchema = new mongoose.Schema({
  conversationId: { type: String, required: true, unique: true },
  messages: [messageSchema],
  lastDisease: String, // Most recent disease discussed
  lastQuery: String, // Most recent query
  diseaseHistory: [String], // All diseases discussed in this conversation
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) }, // 7-day expiration
});

// Auto-delete old conversations
conversationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Conversation', conversationSchema);
