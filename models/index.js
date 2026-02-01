const { mongoose } = require('./db');
const ApplicationPanel = require('./ApplicationPanel');
const ApplicationResponse = require('./ApplicationResponse');
const RestartsConfig = require('./RestartsConfig');
const VerificationConfig = require('./VerificationConfig');
const FeedbackConfig = require('./FeedbackConfig');
const StaffFeedback = require('./StaffFeedback');
const VanityRolesConfig = require('./VanityRolesConfig');
const Embed = require('./Embed');
const Keyword = require('./Keyword');
const Welcome = require('./Welcome');
const GangPriority = require('./GangPriority');
const Gang = require('./Gang');
const Poll = require('./Poll');
const TebexConfig = require('./TebexConfig');
const TebexTransaction = require('./TebexTransaction');
const StatusBlacklist = require('./StatusBlacklist');
const BrandingConfig = require('./BrandingConfig');
const AutoRole = require('./AutoRole');
const StickyMessage = require('./StickyMessage');
const BoosterConfig = require('./BoosterConfig');
const Suggestion = require('./Suggestion');
const FiveMStatusConfig = require('./FiveMStatusConfig');
const ModuleConfig = require('./ModuleConfig');
const WhitelistConfig = require('./WhitelistConfig');

module.exports = {
    mongoose,
    ApplicationPanel,
    ApplicationResponse,
    RestartsConfig,
    VerificationConfig,
    FeedbackConfig,
    StaffFeedback,
    VanityRolesConfig,
    Embed,
    Keyword,
    Welcome,
    GangPriority,
    Gang,
    Poll,
    TebexConfig,
    TebexTransaction,
    StatusBlacklist,
    BrandingConfig,
    AutoRole,
    StickyMessage,
    BoosterConfig,
    Suggestion,
    FiveMStatusConfig,
    ModuleConfig,
    WhitelistConfig
};
