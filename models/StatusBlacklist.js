const mongoose = require('mongoose');

const statusBlacklistSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    keyword: { type: String, required: true },
    action: { type: String, enum: ['ban', 'kick', 'role'], default: 'ban' },
    roleId: { type: String }, // Only used if action is 'role'
    addedBy: { type: String, required: true },
    addedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Compound index to ensure uniqueness of keyword within a guild
statusBlacklistSchema.index({ guildId: 1, keyword: 1 }, { unique: true });

module.exports = mongoose.model('StatusBlacklist', statusBlacklistSchema);
