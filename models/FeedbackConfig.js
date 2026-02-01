const mongoose = require('mongoose');

const feedbackConfigSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    staffRoleId: { type: String, required: true },
    feedbackWallId: { type: String, required: true },
    feedbackLogId: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('FeedbackConfig', feedbackConfigSchema);
