const mongoose = require('mongoose');

const applicationPanelSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    name: { type: String, required: true },
    type: { type: String, required: true },
    channelId: { type: String, required: true },
    logsChannelId: { type: String, required: true },
    roleId: { type: String },
    resultsChannelId: { type: String },
    questions: [
        {
            id: { type: String, required: true },
            label: { type: String, required: true },
            style: { type: Number, required: true }
        }
    ],
    title: { type: String, required: true },
    description: { type: String, required: true }
}, { timestamps: true });

// Compound index to ensure unique panel names per guild
applicationPanelSchema.index({ guildId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('ApplicationPanel', applicationPanelSchema);
