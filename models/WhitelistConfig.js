const mongoose = require('mongoose');

const whitelistConfigSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    channelId: { type: String, required: true },
    enabled: { type: Boolean, default: true },
    duration: { type: Number, required: true }, // Duration in hours
    keywords: {
        type: [String],
        default: ['WL', 'wl', 'whitelist', 'whitelisted', 'whitelist me', 'wl me', 'Whitelist', 'Whitelisted', 'WHITELIST', 'WHITELISTED']
    },
    addedBy: { type: String, required: true },
    addedAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('WhitelistConfig', whitelistConfigSchema);
