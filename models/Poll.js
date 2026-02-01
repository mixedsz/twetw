const mongoose = require('mongoose');

const pollSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    channelId: { type: String, required: true },
    messageId: { type: String, required: true, unique: true },
    question: { type: String, required: true },
    creatorId: { type: String, required: true },
    active: { type: Boolean, default: true },
    upvotes: [{ type: String }], // Array of user IDs
    downvotes: [{ type: String }], // Array of user IDs
    createdAt: { type: Date, default: Date.now },
    endedAt: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('Poll', pollSchema);
