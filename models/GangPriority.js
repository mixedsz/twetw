const mongoose = require('mongoose');

const gangPrioritySchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    managerRoleId: { type: String, required: true },
    logsChannelId: { type: String, required: true }
}, { timestamps: true });

// One config per guild
gangPrioritySchema.index({ guildId: 1 }, { unique: true });

module.exports = mongoose.model('GangPriority', gangPrioritySchema);
