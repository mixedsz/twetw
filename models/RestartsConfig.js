const mongoose = require('mongoose');

const restartsConfigSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    channelId: { type: String, required: true },
    connectLink: { type: String, required: true },
    cfxCode: { type: String, required: true },
    roleId: { type: String, required: true },
    lastPlayerCount: { type: Number, default: null }
}, { timestamps: true });

module.exports = mongoose.model('RestartsConfig', restartsConfigSchema);
