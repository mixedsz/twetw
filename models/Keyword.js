const mongoose = require('mongoose');

const keywordSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String, required: true },
    color: { type: String, default: '#5865F2' },
    footer: { type: String },
    image: { type: String },
    thumbnail: { type: String },
    author: {
        name: { type: String },
        iconURL: { type: String },
        url: { type: String }
    },
    fields: [
        {
            name: { type: String, required: true },
            value: { type: String, required: true },
            inline: { type: Boolean, default: false }
        }
    ]
}, { timestamps: true });

// Compound index to ensure unique keyword names per guild
keywordSchema.index({ guildId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Keyword', keywordSchema);
