const mongoose = require('mongoose');

const embedSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    messageId: { type: String, required: true, unique: true },
    channelId: { type: String, required: true },
    title: { type: String },
    description: { type: String },
    color: { type: String },
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
    ],
    buttons: [
        {
            label: { type: String, required: true },
            url: { type: String, required: true },
            emoji: { type: String }
        }
    ]
}, { timestamps: true });

module.exports = mongoose.model('Embed', embedSchema);
