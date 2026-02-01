const mongoose = require('mongoose');

const brandingConfigSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    status: {
        type: { type: String, enum: ['WATCHING', 'LISTENING', 'STREAMING', 'COMPETING', 'PLAYING'], default: 'PLAYING' },
        text: { type: String, required: true },
        url: { type: String } // Only used for STREAMING type
    },
    embedConfig: {
        color: { type: String, default: '#5865F2' }, // Default Discord blue
        footer: { type: String },
        banner: { type: String } // URL for the banner image used in embeds
    },
    updatedBy: { type: String },
    updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('BrandingConfig', brandingConfigSchema);
