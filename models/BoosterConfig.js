const { mongoose } = require('./db');

const boosterConfigSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    message: { type: String, default: 'Thank you for boosting the server, {member.mention}' },
    enabled: { type: Boolean, default: true }
});

const BoosterConfig = mongoose.model('BoosterConfig', boosterConfigSchema);

module.exports = BoosterConfig;
