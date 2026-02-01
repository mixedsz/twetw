const mongoose = require('mongoose');

const stickyMessageSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    channelId: { type: String, required: true },
    title: { type: String, required: true },
    content: { type: String, required: true },
    embedData: {
        title: { type: String },
        description: { type: String },
        image: { type: String }
    },
    active: { type: Boolean, default: true },
    lastMessageId: { type: String },
    createdBy: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Compound index to ensure uniqueness of title within a channel
stickyMessageSchema.index({ guildId: 1, channelId: 1, title: 1 }, { unique: true });

module.exports = mongoose.model('StickyMessage', stickyMessageSchema);
