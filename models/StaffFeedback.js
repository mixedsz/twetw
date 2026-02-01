const mongoose = require('mongoose');

const staffFeedbackSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    staffUserId: { type: String, required: true },
    upvotes: [
        {
            userId: { type: String, required: true },
            reason: { type: String, required: true },
            timestamp: { type: Date, default: Date.now }
        }
    ],
    downvotes: [
        {
            userId: { type: String, required: true },
            reason: { type: String, required: true },
            timestamp: { type: Date, default: Date.now }
        }
    ]
}, { timestamps: true });

// Compound index to ensure unique staff user per guild
staffFeedbackSchema.index({ guildId: 1, staffUserId: 1 }, { unique: true });

module.exports = mongoose.model('StaffFeedback', staffFeedbackSchema);
