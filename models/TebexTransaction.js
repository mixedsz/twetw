const mongoose = require('mongoose');

const tebexTransactionSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    transactionId: { type: String, required: true },
    username: { type: String },
    packageName: { type: String },
    price: { type: String },
    verified: { type: Boolean, default: false },
    verifiedBy: { type: String },
    verifiedAt: { type: Date },
    createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Compound index to ensure uniqueness of transactionId within a guild
tebexTransactionSchema.index({ guildId: 1, transactionId: 1 }, { unique: true });

module.exports = mongoose.model('TebexTransaction', tebexTransactionSchema);
