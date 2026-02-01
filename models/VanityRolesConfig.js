const mongoose = require('mongoose');

const vanityRolesConfigSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    roleId: { type: String, required: true },
    vanityUrl: { type: String, required: true },
    channelId: { type: String, required: true },
    notificationType: { 
        type: String, 
        enum: ['channel', 'dm', 'both'],
        default: 'channel'
    },
    embedConfig: {
        description: { 
            type: String, 
            default: '{member} has added the vanity ({vanityURL}) to their status, their role has been added.' 
        },
        color: { type: String, default: '#5865F2' }
    }
}, { timestamps: true });

module.exports = mongoose.model('VanityRolesConfig', vanityRolesConfigSchema);
