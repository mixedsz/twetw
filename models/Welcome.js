const mongoose = require('mongoose');

const welcomeSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    channelId: { type: String, required: true },
    enabled: { type: Boolean, default: true },
    message: {
        type: String,
        default: '{member.mention}'
    },
    embedEnabled: { type: Boolean, default: true },
    embedConfig: {
        title: { type: String, default: '{guild.name}!' },
        description: { type: String, default: 'Hey, {member.mention}! We hope you enjoy your stay.' },
        color: { type: String, default: '#5865F2' },
        footer: { type: String, default: 'Member #{memberCount}' },
        image: { type: String },
        thumbnail: { type: String }
    },
    imageGeneration: { type: Boolean, default: true },
    imageConfig: {
        background: { type: String, default: 'default' },
        textColor: { type: String, default: '#FFFFFF' },
        overlayColor: { type: String, default: 'rgba(0, 0, 0, 0.4)' },
        borderColor: { type: String, default: 'transparent' }
    }
}, { timestamps: true });

module.exports = mongoose.model('Welcome', welcomeSchema);
