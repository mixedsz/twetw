const mongoose = require('mongoose');

const fivemStatusConfigSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    channelId: { type: String, required: true },
    messageId: { type: String, default: null },
    cfxCode: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('FiveMStatusConfig', fivemStatusConfigSchema);

