const mongoose = require('mongoose');

const moduleConfigSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    disabledModules: [{ type: String }] // Array of disabled module names
}, { timestamps: true });

module.exports = mongoose.model('ModuleConfig', moduleConfigSchema);

