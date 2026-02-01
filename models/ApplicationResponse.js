const mongoose = require('mongoose');

const applicationResponseSchema = new mongoose.Schema({
    responseId: { type: String, required: true, unique: true },
    guildId: { type: String, required: true },
    panelName: { type: String, required: true },
    userId: { type: String, required: true },
    answers: [
        {
            question: { type: String, required: true },
            answer: { type: String, required: true }
        }
    ],
    timestamp: { type: Date, default: Date.now },
    status: { 
        type: String, 
        enum: ['pending', 'accepted', 'denied'], 
        default: 'pending' 
    },
    decision: {
        by: { type: String },
        reason: { type: String },
        timestamp: { type: Date }
    }
}, { timestamps: true });

module.exports = mongoose.model('ApplicationResponse', applicationResponseSchema);
