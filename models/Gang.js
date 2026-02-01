const mongoose = require('mongoose');

const gangSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    name: { type: String, required: true },
    ownerId: { type: String, required: true },
    tierRoleId: { type: String, required: true },
    slots: { type: Number, required: true, min: 1 },
    members: [
        {
            userId: { type: String, required: true },
            addedAt: { type: Date, default: Date.now }
        }
    ],
    strikes: [
        {
            reason: { type: String, required: true },
            issuedBy: { type: String, required: true },
            issuedAt: { type: Date, default: Date.now }
        }
    ]
}, { timestamps: true });

// Compound index to ensure unique gang names per guild
gangSchema.index({ guildId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Gang', gangSchema);
