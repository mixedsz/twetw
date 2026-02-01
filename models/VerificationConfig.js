const mongoose = require('mongoose');

const verificationConfigSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    channelId: { type: String, required: true },
    roleId: { type: String, required: true },
    type: { 
        type: String, 
        enum: ['simple', 'fivem_passport', 'emoji_captcha', 'image_captcha'],
        required: true 
    },
    embedConfig: {
        title: { type: String, default: 'Verification Required' },
        description: { type: String, default: 'Please verify yourself to access the server.' },
        color: { type: String, default: '#5865F2' },
        footer: { type: String, default: 'Verification System' }
    }
}, { timestamps: true });

module.exports = mongoose.model('VerificationConfig', verificationConfigSchema);
