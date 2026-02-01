const mongoose = require('mongoose');

const suggestionSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    channelId: { type: String, required: true },
    messageId: { type: String, required: true, unique: true },
    suggestion: { type: String, required: true },
    userId: { type: String, required: true },
    upvotes: [{ type: String }], // Array of user IDs
    downvotes: [{ type: String }], // Array of user IDs
    createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('Suggestion', suggestionSchema);

