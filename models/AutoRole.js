const mongoose = require('mongoose');

const autoRoleSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    roleId: { type: String, required: true },
    addedBy: { type: String, required: true },
    addedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Compound index to ensure uniqueness of roleId within a guild
autoRoleSchema.index({ guildId: 1, roleId: 1 }, { unique: true });

module.exports = mongoose.model('AutoRole', autoRoleSchema);
