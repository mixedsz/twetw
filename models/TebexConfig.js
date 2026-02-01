const mongoose = require('mongoose');

const tebexConfigSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    logsChannelId: { type: String, required: true },
    certifiedRoleId: { type: String },
    enabled: { type: Boolean, default: true },
    webhookId: { type: String },
    webhookToken: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('TebexConfig', tebexConfigSchema);
