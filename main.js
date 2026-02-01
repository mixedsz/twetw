const { Client, GatewayIntentBits, Partials, ButtonBuilder, ButtonStyle,
        ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle,
        EmbedBuilder, StringSelectMenuBuilder, PermissionsBitField,
        AttachmentBuilder, ActivityType, ChannelType } = require('discord.js');
const { generateVerificationImage } = require('./utils/emojiImageGenerator');
const fs = require('fs');
const path = require('path');

// Load configuration from config.json
const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));

// Import MongoDB connection
const db = require('./models/db');

// Import MongoDB models
const {
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
} = require('./models');



// Helper function to check database connection before database operations
const safeDbOperation = async (operation, fallback) => {
    try {
        if (!db.isConnected()) {
            console.log('Database not connected, skipping operation');
            return fallback;
        }
        return await operation();
    } catch (error) {
        console.error('Database operation failed:', error);
        return fallback;
    }
};

// Helper function to check if user has owner role
const hasOwnerRole = (member) => {
    if (!config.permissions.ownerRoles || config.permissions.ownerRoles.length === 0) {
        return false;
    }
    return config.permissions.ownerRoles.some(roleId => member.roles.cache.has(roleId));
};

// Helper function to check if user has admin role
const hasAdminRole = (member) => {
    if (!config.permissions.adminRoles || config.permissions.adminRoles.length === 0) {
        return false;
    }
    return config.permissions.adminRoles.some(roleId => member.roles.cache.has(roleId));
};

// Helper function to check if user has owner or admin role
const hasOwnerOrAdminRole = (member) => {
    return hasOwnerRole(member) || hasAdminRole(member);
};

// Initialize client with required intents and partials
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences,  // Add presence intent for vanity roles
        GatewayIntentBits.GuildMessageReactions  // Add reactions intent for suggestions
    ],
    partials: [Partials.Channel, Partials.Message, Partials.Presence, Partials.Reaction]
});

// MongoDB is used for database storage

// Verification types
const VERIFICATION_TYPES = {
    SIMPLE: 'simple',
    FIVEM_PASSPORT: 'fivem_passport',
    EMOJI_CAPTCHA: 'emoji_captcha',
    IMAGE_CAPTCHA: 'image_captcha'
};

// Emoji list for captcha
const CAPTCHA_EMOJIS = ['🍎', '🍌', '🍒', '🍓', '🍊', '🍉', '🍇', '🍍', '🥝', '🥥', '🥑', '🥦', '🌮', '🍕', '🍔', '🍦', '🍩', '🍪', '🍫', '🍬', '🍭', '🧁', '🍰', '🎂', '🍮', '🍯', '🍼', '🥛', '☕', '🍵', '🍶', '🍾', '🍷', '🍸', '🍹', '🍺', '🍻', '🥂', '🥃', '🥤', '🧃', '🧉', '🧊', '🥢', '🍽️', '🍴', '🥄', '🏺'];

// Maps to store application data
const applicationPanels = new Map();
const applicationResponses = new Map();

// Maps to store other module configurations
const feedbackConfig = new Map();
const staffFeedback = new Map();
const verificationConfig = new Map();
const restartsConfig = new Map();
const vanityRolesConfig = new Map();
const boosterConfig = new Map();
const fivemStatusConfig = new Map();
const moduleConfig = new Map(); // Stores disabled modules per guild
const applicationPresets = {
    'staff': {
        title: 'Staff Application',
        description: 'Apply to join our staff team!',
        questions: [
            { id: 'q1', label: 'What is the link to your steam profile?', style: TextInputStyle.Short },
            { id: 'q2', label: 'How old are you?', style: TextInputStyle.Short },
            { id: 'q3', label: 'What is your timezone?', style: TextInputStyle.Short },
            { id: 'q4', label: 'How many hours have you spent on the server?', style: TextInputStyle.Short },
            { id: 'q5', label: 'Tell us about yourself.', style: TextInputStyle.Paragraph },
            { id: 'q6', label: 'How many hours will you be active per week?', style: TextInputStyle.Short },
            { id: 'q7', label: 'Why do you want to be staff?', style: TextInputStyle.Paragraph },
            { id: 'q8', label: 'Why should we pick you over other candidates?', style: TextInputStyle.Paragraph },
            { id: 'q9', label: 'What experience do you have as a moderator', style: TextInputStyle.Paragraph },
            { id: 'q10', label: 'What IRL obligations do you have?', style: TextInputStyle.Paragraph },
            { id: 'q11', label: 'Have you read all of the server rules?', style: TextInputStyle.Short }
        ]
    },
    'partnership': {
        title: 'Partnership Application',
        description: 'Apply for a server partnership!',
        questions: [
            { id: 'q1', label: 'What is your server name?', style: TextInputStyle.Short },
            { id: 'q2', label: 'How many members does your server have?', style: TextInputStyle.Short },
            { id: 'q3', label: 'What is your server about?', style: TextInputStyle.Paragraph },
            { id: 'q4', label: 'How will this benefit both servers?', style: TextInputStyle.Paragraph }
        ]
    },
    'event': {
        title: 'Event Application',
        description: 'Submit your event idea!',
        questions: [
            { id: 'q1', label: 'What is your event name?', style: TextInputStyle.Short },
            { id: 'q2', label: 'Describe your event', style: TextInputStyle.Paragraph },
            { id: 'q3', label: 'What resources do you need?', style: TextInputStyle.Paragraph },
            { id: 'q4', label: 'Proposed date and time', style: TextInputStyle.Short }
        ]
    },
    'ems': {
        title: 'EMS Application',
        description: 'Apply to join our EMS department!',
        questions: [
            { id: 'q1', label: 'What is the link to your steam profile?', style: TextInputStyle.Short },
            { id: 'q2', label: 'How old are you?', style: TextInputStyle.Short },
            { id: 'q3', label: 'What is your Timezone?', style: TextInputStyle.Short },
            { id: 'q4', label: 'How many hours have you spent on the server?', style: TextInputStyle.Short },
            { id: 'q5', label: 'What previous experience do you have as EMS?', style: TextInputStyle.Paragraph },
            { id: 'q6', label: 'What would you bring to the EMS Department?', style: TextInputStyle.Paragraph },
            { id: 'q7', label: 'Why should you be part of EMS?', style: TextInputStyle.Paragraph },
            { id: 'q8', label: 'Have you been kicked or banned before?', style: TextInputStyle.Short },
            { id: 'q9', label: 'Do you want to be full time / part time?', style: TextInputStyle.Short },
            { id: 'q10', label: 'Will you follow EMS guidelines?', style: TextInputStyle.Short }
        ]
    },
    'police': {
        title: 'Police Application',
        description: 'Apply to join our Police department!',
        questions: [
            { id: 'q1', label: 'What is the link to your steam profile?', style: TextInputStyle.Short },
            { id: 'q2', label: 'How old are you?', style: TextInputStyle.Short },
            { id: 'q3', label: 'What is your timezone?', style: TextInputStyle.Short },
            { id: 'q4', label: 'How many hours have you spent on the server?', style: TextInputStyle.Short },
            { id: 'q5', label: 'What previous experience do you have as PD?', style: TextInputStyle.Paragraph },
            { id: 'q6', label: 'Why should we choose you over other people?', style: TextInputStyle.Paragraph },
            { id: 'q7', label: 'Why do you want to be a Police Officer?', style: TextInputStyle.Paragraph },
            { id: 'q8', label: 'What are your biggest strengths & weaknesses?', style: TextInputStyle.Paragraph },
            { id: 'q9', label: 'Do you want to be full time / part time?', style: TextInputStyle.Short },
            { id: 'q10', label: 'How many hours will you be active per week?', style: TextInputStyle.Short },
            { id: 'q11', label: 'In what situation must you use lethal force?', style: TextInputStyle.Paragraph },
            { id: 'q12', label: 'Have you been kicked or banned before?', style: TextInputStyle.Short },
            { id: 'q13', label: 'Do you agree to obey higherups?', style: TextInputStyle.Short },
            { id: 'q14', label: 'Will you follow PD guidelines?', style: TextInputStyle.Short }
        ]
    },
    'mechanic': {
        title: 'Mechanic Application',
        description: 'Apply to join our Mechanic team!',
        questions: [
            { id: 'q1', label: 'What is the link to your steam profile?', style: TextInputStyle.Short },
            { id: 'q2', label: 'How old are you?', style: TextInputStyle.Short },
            { id: 'q3', label: 'What is your timezone?', style: TextInputStyle.Short },
            { id: 'q4', label: 'How many hours have you spent on the server?', style: TextInputStyle.Short },
            { id: 'q5', label: 'What experience do you have as a mechanic?', style: TextInputStyle.Paragraph },
            { id: 'q6', label: 'How many hours will you be active per day?', style: TextInputStyle.Short },
            { id: 'q7', label: 'Why do you want to be a Mechanic?', style: TextInputStyle.Paragraph },
            { id: 'q8', label: 'Why should we pick you over other candidates?', style: TextInputStyle.Paragraph },
            { id: 'q9', label: 'Do you want to be full time / part time?', style: TextInputStyle.Short },
            { id: 'q10', label: 'Do you agree to follow Mechanic guidelines?', style: TextInputStyle.Short }
        ]
    }
};

// Register slash commands when bot is ready
client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}`);

    // Set global status to "Watching /help | .gg/flakedev"
    client.user.setActivity('/help | .gg/flakedev', { type: ActivityType.Watching });
    console.log('Set global status to "Watching /help | .gg/flakedev"');

    // Load application panels
    await loadApplicationPanels();

    // Load restarts configurations
    await loadRestartsConfigs();

    // Load FiveM status configurations
    await loadFiveMStatusConfig();



    const commands = [
        {
            name: 'help',
            description: 'Get detailed help information about commands',
            options: [
                {
                    name: 'command',
                    description: 'Specific command to get help for',
                    type: 3, // STRING
                    required: false,
                    choices: [
                        { name: 'Applications', value: 'applications' },
                        { name: 'Auto Roles', value: 'autoroles' },
                        { name: 'Booster', value: 'booster' },
                        { name: 'Branding', value: 'branding' },
                        { name: 'Embed', value: 'embed' },
                        { name: 'Feedback', value: 'feedback' },
                        { name: 'FiveM Status', value: 'fivemstatus' },
                        { name: 'Gang Priority', value: 'gangpriority' },
                        { name: 'Info', value: 'info' },
                        { name: 'Keyword', value: 'keyword' },
                        { name: 'Lookup', value: 'lookup' },
                        { name: 'Mass Unban', value: 'mass-unban' },
                        { name: 'Modules', value: 'modules' },
                        { name: 'Poll', value: 'poll' },
                        { name: 'Priority Queue', value: 'prio' },
                        { name: 'Purge', value: 'purge' },
                        { name: 'Restarts', value: 'restarts' },
                        { name: 'Staff', value: 'staff' },
                        { name: 'Status Blacklist', value: 'status_blacklist' },
                        { name: 'Sticky Message', value: 'stickymessage' },
                        { name: 'Strikes', value: 'strike' },
                        { name: 'Suggestion', value: 'suggestion' },
                        { name: 'Tebex', value: 'tebex' },
                        { name: 'Vanity Roles', value: 'vanityroles' },
                        { name: 'Verification', value: 'verification' }
                    ]
                }
            ]
        },
        {
            name: 'tebex',
            description: 'Configure the Tebex verification system',
            options: [
                {
                    name: 'setup',
                    description: 'Set up the Tebex verification system',
                    type: 1, // SUB_COMMAND
                    options: [
                        {
                            name: 'logs_channel',
                            description: 'The channel where Tebex logs will be sent',
                            type: 7, // CHANNEL
                            required: true
                        },
                        {
                            name: 'certified_role',
                            description: 'The role that can use Tebex verification commands',
                            type: 8, // ROLE
                            required: false
                        }
                    ]
                }
            ]
        },
        {
            name: 'lookup',
            description: 'Look up a Tebex transaction',
            options: [
                {
                    name: 'tebex_id',
                    description: 'The Tebex transaction ID to look up',
                    type: 3, // STRING
                    required: true
                }
            ]
        },
        {
            name: 'verify',
            description: 'Verify a Tebex transaction',
            options: [
                {
                    name: 'tebex_id',
                    description: 'The Tebex transaction ID to verify',
                    type: 3, // STRING
                    required: true
                }
            ]
        },
        {
            name: 'purge',
            description: 'Delete a specified amount of messages',
            options: [
                {
                    name: 'amount',
                    description: 'The amount of messages to delete',
                    type: 4, // INTEGER
                    required: true
                },
                {
                    name: 'channel',
                    description: 'The channel to delete messages in (defaults to current channel)',
                    type: 7, // CHANNEL
                    required: false
                }
            ]
        },
        {
            name: 'role',
            description: 'Add a role to a user',
            options: [
                {
                    name: 'user',
                    description: 'The user to add the role to',
                    type: 6, // USER
                    required: true
                },
                {
                    name: 'role',
                    description: 'The role to add',
                    type: 8, // ROLE
                    required: true
                }
            ]
        },
        {
            name: 'ban',
            description: 'Ban a user from the server with enhanced protection',
            options: [
                {
                    name: 'user',
                    description: 'The user to ban',
                    type: 6, // USER
                    required: true
                },
                {
                    name: 'reason',
                    description: 'The reason for the ban',
                    type: 3, // STRING
                    required: false
                },
                {
                    name: 'delete_messages',
                    description: 'Delete messages from the last X days (0-7)',
                    type: 4, // INTEGER
                    required: false
                }
            ]
        },
        {
            name: 'poll',
            description: 'Create and manage community polls',
            options: [
                {
                    name: 'start',
                    description: 'Start a new poll',
                    type: 1 // SUB_COMMAND
                },
                {
                    name: 'end',
                    description: 'End an existing poll',
                    type: 1, // SUB_COMMAND
                    options: [
                        {
                            name: 'message_id',
                            description: 'The message ID of the poll to end',
                            type: 3, // STRING
                            required: true
                        }
                    ]
                }
            ]
        },
        {
            name: 'stickymessage',
            description: 'Manage sticky messages',
            options: [
                {
                    name: 'create',
                    description: 'Create a new sticky message',
                    type: 1, // SUB_COMMAND
                    options: [
                        {
                            name: 'channel',
                            description: 'The channel to create the sticky message in',
                            type: 7, // CHANNEL
                            required: true
                        }
                    ]
                },
                {
                    name: 'delete',
                    description: 'Delete a sticky message',
                    type: 1, // SUB_COMMAND
                    options: [
                        {
                            name: 'channel',
                            description: 'The channel the sticky message is in',
                            type: 7, // CHANNEL
                            required: true
                        }
                    ]
                },
                {
                    name: 'status',
                    description: 'Change the status of a sticky message',
                    type: 1, // SUB_COMMAND
                    options: [
                        {
                            name: 'channel',
                            description: 'The channel the sticky message is in',
                            type: 7, // CHANNEL
                            required: true
                        },
                        {
                            name: 'status',
                            description: 'The new status of the sticky message',
                            type: 3, // STRING
                            required: true,
                            choices: [
                                { name: 'Active', value: 'active' },
                                { name: 'Paused', value: 'paused' }
                            ]
                        }
                    ]
                }
            ]
        },
        {
            name: 'autoroles',
            description: 'Manage auto roles',
            options: [
                {
                    name: 'create',
                    description: 'Create a new auto role',
                    type: 1, // SUB_COMMAND
                    options: [
                        {
                            name: 'role',
                            description: 'The role to automatically assign to new members',
                            type: 8, // ROLE
                            required: true
                        }
                    ]
                },
                {
                    name: 'list',
                    description: 'List all auto roles',
                    type: 1 // SUB_COMMAND
                },
                {
                    name: 'delete',
                    description: 'Delete an auto role',
                    type: 1, // SUB_COMMAND
                    options: [
                        {
                            name: 'role',
                            description: 'The role to remove from auto roles',
                            type: 8, // ROLE
                            required: true
                        }
                    ]
                },
                {
                    name: 'whitelist',
                    description: 'Configure automatic whitelist role assignment',
                    type: 1, // SUB_COMMAND
                    options: [
                        {
                            name: 'time',
                            description: 'Duration in hours for whitelist assignment',
                            type: 4, // INTEGER
                            required: true
                        },
                        {
                            name: 'channel',
                            description: 'The channel to monitor for whitelist requests',
                            type: 7, // CHANNEL
                            required: true
                        }
                    ]
                },
                {
                    name: 'whitelist-disable',
                    description: 'Disable the automatic whitelist role assignment',
                    type: 1 // SUB_COMMAND
                }
            ]
        },
        {
            name: 'branding',
            description: 'Configure bot branding settings',
            options: [
                {
                    name: 'name',
                    description: 'Set the bot\'s nickname in this server',
                    type: 1, // SUB_COMMAND
                    options: [
                        {
                            name: 'nickname',
                            description: 'The nickname to set for the bot',
                            type: 3, // STRING
                            required: true
                        }
                    ]
                },
                {
                    name: 'colour',
                    description: 'Set the color for all embeds',
                    type: 1, // SUB_COMMAND
                    options: [
                        {
                            name: 'colour',
                            description: 'The hex color code (e.g., #FF0000 for red)',
                            type: 3, // STRING
                            required: true
                        }
                    ]
                },
                {
                    name: 'footer',
                    description: 'Set the footer for all embeds',
                    type: 1 // SUB_COMMAND
                },
                {
                    name: 'banner',
                    description: 'Set the banner image for embeds',
                    type: 1, // SUB_COMMAND
                    options: [
                        {
                            name: 'url',
                            description: 'The URL of the banner image',
                            type: 3, // STRING
                            required: true
                        }
                    ]
                }
            ]
        },
        {
            name: 'status_blacklist',
            description: 'Manage status blacklist',
            options: [
                {
                    name: 'add',
                    description: 'Add a keyword to the status blacklist',
                    type: 1, // SUB_COMMAND
                    options: [
                        {
                            name: 'keyword',
                            description: 'The keyword to blacklist',
                            type: 3, // STRING
                            required: true
                        },
                        {
                            name: 'action',
                            description: 'The action to take when the keyword is detected',
                            type: 3, // STRING
                            required: true,
                            choices: [
                                { name: 'Ban', value: 'ban' },
                                { name: 'Kick', value: 'kick' },
                                { name: 'Assign Role', value: 'role' }
                            ]
                        },
                        {
                            name: 'role',
                            description: 'The role to assign (only used if action is "role")',
                            type: 8, // ROLE
                            required: false
                        }
                    ]
                },
                {
                    name: 'del',
                    description: 'Remove a keyword from the status blacklist',
                    type: 1, // SUB_COMMAND
                    options: [
                        {
                            name: 'keyword',
                            description: 'The keyword to remove from the blacklist',
                            type: 3, // STRING
                            required: true
                        }
                    ]
                },
                {
                    name: 'list',
                    description: 'List all blacklisted keywords',
                    type: 1 // SUB_COMMAND
                }
            ]
        },
        {
            name: 'strike',
            description: 'Manage gang strikes',
            options: [
                {
                    name: 'add',
                    description: 'Add a strike to a gang',
                    type: 1, // SUB_COMMAND
                    options: [
                        {
                            name: 'gang_name',
                            description: 'The name of the gang to add the strike to',
                            type: 3, // STRING
                            required: true
                        },
                        {
                            name: 'reason',
                            description: 'The reason for adding the strike',
                            type: 3, // STRING
                            required: true
                        }
                    ]
                },
                {
                    name: 'remove',
                    description: 'Remove a strike from a gang',
                    type: 1, // SUB_COMMAND
                    options: [
                        {
                            name: 'gang_name',
                            description: 'The name of the gang to remove the strike from',
                            type: 3, // STRING
                            required: true
                        },
                        {
                            name: 'strike',
                            description: 'The index of the strike to remove (1-based)',
                            type: 4, // INTEGER
                            required: true
                        }
                    ]
                },
                {
                    name: 'view',
                    description: 'View strikes for a gang',
                    type: 1, // SUB_COMMAND
                    options: [
                        {
                            name: 'gang_name',
                            description: 'The name of the gang to view strikes for',
                            type: 3, // STRING
                            required: true
                        }
                    ]
                }
            ]
        },
        {
            name: 'gangpriority',
            description: 'Configure the gang priority system',
            options: [
                {
                    name: 'setup',
                    description: 'Setup the gang priority system',
                    type: 1, // SUB_COMMAND
                    options: [
                        {
                            name: 'manager_role',
                            description: 'Role that can manage gangs',
                            type: 8, // ROLE
                            required: true
                        },
                        {
                            name: 'logs_channel',
                            description: 'Channel to log gang priority actions',
                            type: 7, // CHANNEL
                            required: true
                        }
                    ]
                }
            ]
        },
        {
            name: 'gang',
            description: 'Manage gangs',
            options: [
                {
                    name: 'create',
                    description: 'Create a new gang',
                    type: 1, // SUB_COMMAND
                    options: [
                        {
                            name: 'name',
                            description: 'Name of the gang',
                            type: 3, // STRING
                            required: true
                        },
                        {
                            name: 'owner',
                            description: 'Owner of the gang',
                            type: 6, // USER
                            required: true
                        },
                        {
                            name: 'tier',
                            description: 'Priority role to give to gang members',
                            type: 8, // ROLE
                            required: true
                        },
                        {
                            name: 'slots',
                            description: 'Number of priority slots',
                            type: 4, // INTEGER
                            required: true
                        }
                    ]
                },
                {
                    name: 'upgrade',
                    description: 'Upgrade a gang',
                    type: 1, // SUB_COMMAND
                    options: [
                        {
                            name: 'name',
                            description: 'Name of the gang',
                            type: 3, // STRING
                            required: true
                        },
                        {
                            name: 'tier',
                            description: 'New priority role to give to gang members',
                            type: 8, // ROLE
                            required: false
                        },
                        {
                            name: 'slots',
                            description: 'New number of priority slots',
                            type: 4, // INTEGER
                            required: false
                        }
                    ]
                },
                {
                    name: 'lookup',
                    description: 'Look up a gang',
                    type: 1, // SUB_COMMAND
                    options: [
                        {
                            name: 'gang_name',
                            description: 'Name of the gang to look up',
                            type: 3, // STRING
                            required: true
                        }
                    ]
                },
                {
                    name: 'list',
                    description: 'List all gangs',
                    type: 1 // SUB_COMMAND
                },
                {
                    name: 'delete',
                    description: 'Delete a gang',
                    type: 1, // SUB_COMMAND
                    options: [
                        {
                            name: 'name',
                            description: 'Name of the gang to delete',
                            type: 3, // STRING
                            required: true
                        }
                    ]
                }
            ]
        },
        {
            name: 'prio',
            description: 'Manage gang priority',
            options: [
                {
                    name: 'add',
                    description: 'Add priority to a user',
                    type: 1, // SUB_COMMAND
                    options: [
                        {
                            name: 'user',
                            description: 'User to add priority to',
                            type: 6, // USER
                            required: true
                        }
                    ]
                },
                {
                    name: 'remove',
                    description: 'Remove priority from a user',
                    type: 1, // SUB_COMMAND
                    options: [
                        {
                            name: 'user',
                            description: 'User to remove priority from',
                            type: 6, // USER
                            required: true
                        }
                    ]
                }
            ]
        },
        {
            name: 'mass-unban',
            description: 'Unban all members from your server',
            options: []
        },
        {
            name: 'booster',
            description: 'Configure the booster auto-responder',
            options: []
        },
        {
            name: 'info',
            description: 'Display information about the bot',
            options: []
        },
        {
            name: 'welcome',
            description: 'Manage the welcome system',
            options: [
                {
                    name: 'setup',
                    description: 'Setup the welcome system',
                    type: 1, // SUB_COMMAND
                    options: [
                        {
                            name: 'channel',
                            description: 'Channel to send welcome messages',
                            type: 7, // CHANNEL
                            required: true
                        }
                    ]
                }
            ]
        },
        {
            name: 'keyword',
            description: 'Manage keyword responses',
            options: [
                {
                    name: 'create',
                    description: 'Create a new keyword response',
                    type: 1, // SUB_COMMAND
                    options: [
                        {
                            name: 'name',
                            description: 'The keyword that triggers the response',
                            type: 3, // STRING
                            required: true
                        }
                    ]
                },
                {
                    name: 'delete',
                    description: 'Delete a keyword response',
                    type: 1, // SUB_COMMAND
                    options: [
                        {
                            name: 'name',
                            description: 'The keyword to delete',
                            type: 3, // STRING
                            required: true
                        }
                    ]
                },
                {
                    name: 'list',
                    description: 'List all keyword responses',
                    type: 1 // SUB_COMMAND
                }
            ]
        },
        {
            name: 'embed',
            description: 'Create and edit embeds',
            options: [
                {
                    name: 'generate',
                    description: 'Generate a new embed',
                    type: 1, // SUB_COMMAND
                    options: [
                        {
                            name: 'channel',
                            description: 'Channel to post the embed',
                            type: 7, // CHANNEL
                            required: true
                        }
                    ]
                },
                {
                    name: 'edit',
                    description: 'Edit an existing embed',
                    type: 1, // SUB_COMMAND
                    options: [
                        {
                            name: 'message_id',
                            description: 'ID of the message containing the embed to edit',
                            type: 3, // STRING
                            required: true
                        },
                        {
                            name: 'channel',
                            description: 'Channel containing the embed',
                            type: 7, // CHANNEL
                            required: true
                        }
                    ]
                },
                {
                    name: 'template',
                    description: 'Use a pre-made embed template',
                    type: 1, // SUB_COMMAND
                    options: [
                        {
                            name: 'type',
                            description: 'The type of template to use',
                            type: 3, // STRING
                            required: true,
                            choices: [
                                { name: 'Starter Tips', value: 'starter_tips' },
                                { name: 'Donations', value: 'donations' },
                                { name: 'Greenzone Locations', value: 'greenzone' },
                                { name: 'Change Logs', value: 'changelogs' }
                            ]
                        },
                        {
                            name: 'channel',
                            description: 'Channel to post the embed',
                            type: 7, // CHANNEL
                            required: true
                        }
                    ]
                }
            ]
        },
        {
            name: 'vanityroles',
            description: 'Manage vanity roles for your server',
            options: [
                {
                    name: 'setup',
                    description: 'Setup the Vanity Roles Module',
                    type: 1, // SUB_COMMAND
                    options: [
                        {
                            name: 'role',
                            description: 'Role to assign to users with your vanity URL in their status',
                            type: 8, // ROLE
                            required: true
                        },
                        {
                            name: 'url',
                            description: 'Your server\'s vanity URL (e.g., discord.gg/hville)',
                            type: 3, // STRING
                            required: true
                        },
                        {
                            name: 'channel',
                            description: 'Channel to post vanity notifications',
                            type: 7, // CHANNEL
                            required: true
                        },
                        {
                            name: 'notification_type',
                            description: 'Where to send notifications',
                            type: 3, // STRING
                            required: true,
                            choices: [
                                { name: 'Log Channel', value: 'channel' },
                                { name: 'Direct Message', value: 'dm' },
                                { name: 'Both', value: 'both' }
                            ]
                        }
                    ]
                },
                {
                    name: 'embed',
                    description: 'Customize the vanity notification embed',
                    type: 1 // SUB_COMMAND
                }
            ]
        },
        {
            name: 'feedback',
            description: 'Setup the Staff Feedback system',
            options: [
                {
                    name: 'setup',
                    description: 'Setup the Staff Feedback system',
                    type: 1, // SUB_COMMAND
                    options: [
                        {
                            name: 'staff_role',
                            description: 'The role which all of your staff members have',
                            type: 8, // ROLE
                            required: true
                        },
                        {
                            name: 'feedback_wall',
                            description: 'The channel to contain the feedback wall',
                            type: 7, // CHANNEL
                            required: true
                        },
                        {
                            name: 'feedback_log',
                            description: 'Optional: The channel to log feedback reasons in',
                            type: 7, // CHANNEL
                            required: false
                        }
                    ]
                }
            ]
        },
        {
            name: 'staff',
            description: 'Staff feedback commands',
            options: [
                {
                    name: 'upvote',
                    description: 'Upvote a staff member',
                    type: 1, // SUB_COMMAND
                    options: [
                        {
                            name: 'staff_member',
                            description: 'The staff member to upvote',
                            type: 6, // USER
                            required: true
                        },
                        {
                            name: 'reason',
                            description: 'The reason for upvoting this staff member',
                            type: 3, // STRING
                            required: true
                        }
                    ]
                },
                {
                    name: 'downvote',
                    description: 'Downvote a staff member',
                    type: 1, // SUB_COMMAND
                    options: [
                        {
                            name: 'staff_member',
                            description: 'The staff member to downvote',
                            type: 6, // USER
                            required: true
                        },
                        {
                            name: 'reason',
                            description: 'The reason for downvoting this staff member',
                            type: 3, // STRING
                            required: true
                        }
                    ]
                }
            ]
        },
        {
            name: 'verification',
            description: 'Manage server verification system',
            options: [
                {
                    name: 'setup',
                    description: 'Setup the Verification Module',
                    type: 1, // SUB_COMMAND
                    options: [
                        {
                            name: 'channel',
                            description: 'Channel to post the verification embed',
                            type: 7, // CHANNEL
                            required: true
                        },
                        {
                            name: 'role',
                            description: 'Role to assign to verified users',
                            type: 8, // ROLE
                            required: true
                        },
                        {
                            name: 'type',
                            description: 'Type of verification to use',
                            type: 3, // STRING
                            required: true,
                            choices: [
                                { name: 'Simple Verification', value: VERIFICATION_TYPES.SIMPLE },
                                { name: 'FiveM Passport', value: VERIFICATION_TYPES.FIVEM_PASSPORT },
                                { name: 'Emoji Captcha', value: VERIFICATION_TYPES.EMOJI_CAPTCHA },
                                { name: 'Image Captcha', value: VERIFICATION_TYPES.IMAGE_CAPTCHA }
                            ]
                        }
                    ]
                },
                {
                    name: 'embed',
                    description: 'Customize the verification embed',
                    type: 1 // SUB_COMMAND
                }
            ]
        },
        {
            name: 'restarts',
            description: 'Manage server restart notifications',
            options: [
                {
                    name: 'setup',
                    description: 'Setup the Restarts Module',
                    type: 1, // SUB_COMMAND
                    options: [
                        {
                            name: 'channel',
                            description: 'Channel to post restart notifications',
                            type: 7, // CHANNEL
                            required: true
                        },
                        {
                            name: 'connect_link',
                            description: 'FiveM connect link (e.g., cfx.re/join/abc123)',
                            type: 3, // STRING
                            required: true
                        },
                        {
                            name: 'role',
                            description: 'Role to ping when server restarts',
                            type: 8, // ROLE
                            required: true
                        }
                    ]
                }
            ]
        },
        {
            name: 'applications',
            description: 'Manage application panels',
            options: [
                {
                    name: 'create',
                    description: 'Create an application panel',
                    type: 1, // SUB_COMMAND
                    options: [
                        {
                            name: 'name',
                            description: 'Name of the application panel',
                            type: 3, // STRING
                            required: true
                        },
                        {
                            name: 'type',
                            description: 'Type of application preset',
                            type: 3, // STRING
                            required: true,
                            choices: [
                                { name: 'Staff Application', value: 'staff' },
                                { name: 'Partnership Application', value: 'partnership' },
                                { name: 'Event Application', value: 'event' },
                                { name: 'EMS Application', value: 'ems' },
                                { name: 'Police Application', value: 'police' },
                                { name: 'Mechanic Application', value: 'mechanic' }
                            ]
                        },
                        {
                            name: 'channel',
                            description: 'Channel to post the application panel',
                            type: 7, // CHANNEL
                            required: true
                        },
                        {
                            name: 'logs',
                            description: 'Channel to post application responses',
                            type: 7, // CHANNEL
                            required: true
                        },
                        {
                            name: 'role',
                            description: 'Role to assign to accepted applicants',
                            type: 8, // ROLE
                            required: false
                        },
                        {
                            name: 'results',
                            description: 'Channel to post acceptance/denial results',
                            type: 7, // CHANNEL
                            required: false
                        }
                    ]
                },
                {
                    name: 'delete',
                    description: 'Delete an application panel',
                    type: 1, // SUB_COMMAND
                    options: [
                        {
                            name: 'name',
                            description: 'Name of the application panel to delete',
                            type: 3, // STRING
                            required: true
                        }
                    ]
                },
                {
                    name: 'multi',
                    description: 'Create a multi-panel with multiple applications',
                    type: 1, // SUB_COMMAND
                    options: [
                        {
                            name: 'channel',
                            description: 'Channel to post the multi-panel',
                            type: 7, // CHANNEL
                            required: true
                        },
                        {
                            name: 'title',
                            description: 'Title for the multi-panel',
                            type: 3, // STRING
                            required: true
                        }
                    ]
                }
            ]
        },
        {
            name: 'suggestion',
            description: 'Submit a suggestion',
            options: [
                {
                    name: 'suggestion',
                    description: 'Your suggestion',
                    type: 3, // STRING
                    required: true
                }
            ]
        },
        {
            name: 'fivemstatus',
            description: 'Manage FiveM server status display',
            options: [
                {
                    name: 'setup',
                    description: 'Setup the FiveM Status Module',
                    type: 1, // SUB_COMMAND
                    options: [
                        {
                            name: 'channel',
                            description: 'Channel to post server status',
                            type: 7, // CHANNEL
                            required: true
                        },
                        {
                            name: 'cfx_code',
                            description: 'CFX code or full link (e.g., yg6joj or cfx.re/join/yg6joj)',
                            type: 3, // STRING
                            required: true
                        }
                    ]
                }
            ]
        },
        {
            name: 'modules',
            description: 'Enable or disable bot modules',
            options: [
                {
                    name: 'enable',
                    description: 'Enable a module',
                    type: 1, // SUB_COMMAND
                    options: [
                        {
                            name: 'module',
                            description: 'The module to enable',
                            type: 3, // STRING
                            required: true,
                            choices: [
                                { name: 'Tebex Module', value: 'tebex' },
                                { name: 'FiveM Restarts Module', value: 'restarts' },
                                { name: 'FiveM Status Module', value: 'fivemstatus' },
                                { name: 'Verification Module', value: 'verification' },
                                { name: 'Applications Module', value: 'applications' },
                                { name: 'Staff Feedback Module', value: 'feedback' },
                                { name: 'Vanity Roles Module', value: 'vanityroles' },
                                { name: 'Keyword Response Module', value: 'keyword' },
                                { name: 'Welcome Module', value: 'welcome' },
                                { name: 'Booster Module', value: 'booster' },
                                { name: 'Auto Roles Module', value: 'autoroles' },
                                { name: 'Sticky Message Module', value: 'stickymessage' },
                                { name: 'Suggestion Module', value: 'suggestion' },
                                { name: 'Poll Module', value: 'poll' },
                                { name: 'Embed Module', value: 'embed' },
                                { name: 'Gang Priority Module', value: 'gangpriority' },
                                { name: 'Status Blacklist Module', value: 'status_blacklist' },
                                { name: 'Branding Module', value: 'branding' },
                                { name: 'Miscellaneous Module', value: 'miscellaneous' }
                            ]
                        }
                    ]
                },
                {
                    name: 'disable',
                    description: 'Disable a module',
                    type: 1, // SUB_COMMAND
                    options: [
                        {
                            name: 'module',
                            description: 'The module to disable',
                            type: 3, // STRING
                            required: true,
                            choices: [
                                { name: 'Tebex Module', value: 'tebex' },
                                { name: 'FiveM Restarts Module', value: 'restarts' },
                                { name: 'FiveM Status Module', value: 'fivemstatus' },
                                { name: 'Verification Module', value: 'verification' },
                                { name: 'Applications Module', value: 'applications' },
                                { name: 'Staff Feedback Module', value: 'feedback' },
                                { name: 'Vanity Roles Module', value: 'vanityroles' },
                                { name: 'Keyword Response Module', value: 'keyword' },
                                { name: 'Welcome Module', value: 'welcome' },
                                { name: 'Booster Module', value: 'booster' },
                                { name: 'Auto Roles Module', value: 'autoroles' },
                                { name: 'Sticky Message Module', value: 'stickymessage' },
                                { name: 'Suggestion Module', value: 'suggestion' },
                                { name: 'Poll Module', value: 'poll' },
                                { name: 'Embed Module', value: 'embed' },
                                { name: 'Gang Priority Module', value: 'gangpriority' },
                                { name: 'Status Blacklist Module', value: 'status_blacklist' },
                                { name: 'Branding Module', value: 'branding' },
                                { name: 'Miscellaneous Module', value: 'miscellaneous' }
                            ]
                        }
                    ]
                },
                {
                    name: 'list',
                    description: 'List all modules and their status',
                    type: 1 // SUB_COMMAND
                }
            ]
        }
    ];

    try {
        await client.application.commands.set(commands);
        console.log('Slash commands registered successfully');
    } catch (error) {
        console.error('Error registering slash commands:', error);
    }
});

// Handle slash commands
client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const { commandName, options } = interaction;

    // Allow only /info and /help in DMs - block all other commands
    if (!interaction.guild) {
        if (commandName !== 'info' && commandName !== 'help') {
            return interaction.reply({
                content: '❌ This command can only be used in a server, not in DMs.',
                ephemeral: true
            });
        }
    }

    // Define commands that require owner role (high power commands)
    const ownerCommands = ['mass-unban', 'gangpriority', 'gang', 'branding', 'status_blacklist', 'ban'];

    // Define commands that require admin role
    const adminCommands = ['feedback', 'vanityroles', 'embed', 'keyword', 'welcome', 'poll', 'purge', 'tebex', 'lookup', 'verify', 'strike', 'autoroles', 'stickymessage', 'booster', 'applications', 'verification', 'restarts', 'fivemstatus', 'suggestion', 'staff', 'prio', 'modules', 'role'];

    // Define module to commands mapping
    const moduleCommands = {
        'tebex': ['tebex', 'lookup', 'verify'],
        'restarts': ['restarts'],
        'fivemstatus': ['fivemstatus'],
        'verification': ['verification'],
        'applications': ['applications'],
        'feedback': ['feedback', 'staff'],
        'vanityroles': ['vanityroles'],
        'keyword': ['keyword'],
        'welcome': ['welcome'],
        'booster': ['booster'],
        'autoroles': ['autoroles'],
        'stickymessage': ['stickymessage'],
        'suggestion': ['suggestion'],
        'poll': ['poll'],
        'embed': ['embed'],
        'gangpriority': ['gangpriority', 'gang'],
        'status_blacklist': ['status_blacklist'],
        'branding': ['branding'],
        'miscellaneous': ['purge', 'strike', 'prio', 'info', 'help', 'role', 'ban']
    };

    // Check permissions based on command (skip for DM commands)
    if (interaction.guild) {
        if (ownerCommands.includes(commandName)) {
            // Owner commands require owner role OR administrator permission
            if (!hasOwnerRole(interaction.member) && !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return interaction.reply({
                    content: 'You need Owner role or Administrator permission to use this command.',
                    ephemeral: true
                });
            }
        }
        else if (adminCommands.includes(commandName)) {
            // Admin commands require admin role OR owner role OR administrator permission
            if (!hasAdminRole(interaction.member) && !hasOwnerRole(interaction.member) && !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return interaction.reply({
                    content: 'You need Admin role, Owner role, or Administrator permission to use this command.',
                    ephemeral: true
                });
            }
        }
    }

    // Check if command's module is disabled (skip for modules command itself and info/help)
    if (commandName !== 'modules' && commandName !== 'info' && commandName !== 'help') {
        const guildId = interaction.guild.id;
        const guildModuleConfig = moduleConfig.get(guildId);

        if (guildModuleConfig && guildModuleConfig.disabledModules) {
            // Find which module this command belongs to
            for (const [moduleName, commands] of Object.entries(moduleCommands)) {
                if (commands.includes(commandName)) {
                    if (guildModuleConfig.disabledModules.includes(moduleName)) {
                        return interaction.reply({
                            content: `❌ This command is part of the **${moduleName}** module which is currently disabled. An administrator can enable it using \`/modules enable\`.`,
                            ephemeral: true
                        });
                    }
                    break;
                }
            }
        }
    }

    if (commandName === 'info') {
        try {
            // Create the embed
            const embed = new EmbedBuilder()
                .setTitle(`About ${client.user.username}`)
                .setDescription('Managing a FiveM Server. Made Simple. Our team has spent countless hours perfecting our Discord bot to improve productivity for FiveM servers.')
                .addFields(
                    { name: 'Information', value: '**Developer:** @flakedev\n**Library:** discord.js v14\n**Database:** MongoDB' }
                )
                .setColor(global.brandingConfig && global.brandingConfig.embedConfig && global.brandingConfig.embedConfig.color ? global.brandingConfig.embedConfig.color : '#5865F2')
                .setThumbnail(client.user.displayAvatarURL({ dynamic: true }));

            // Create buttons
            const websiteButton = new ButtonBuilder()
                .setLabel('Automated Website')
                .setStyle(ButtonStyle.Link)
                .setURL('https://reliantservices.cc/'); // Replace with your actual website URL

            const supportButton = new ButtonBuilder()
                .setLabel('Support Server')
                .setStyle(ButtonStyle.Link)
                .setURL('https://discord.gg/flakedev'); // Replace with your actual support server URL

            // Add buttons to an action row
            const row = new ActionRowBuilder()
                .addComponents(websiteButton, supportButton);

            // Send the embed with buttons
            return interaction.reply({
                embeds: [embed],
                components: [row]
            });
        } catch (error) {
            console.error('Error executing info command:', error);
            return interaction.reply({
                content: 'An error occurred while executing the command.',
                ephemeral: true
            });
        }
    }

    else if (commandName === 'help') {
        const specificCommand = options.getString('command');

        // Create a function to handle button interactions
        const createHelpEmbed = (command) => {
            let embed = new EmbedBuilder()
                .setColor('#5865F2') // Discord Blue
                .setTimestamp();

            // Apply branding color but not the image
            if (global.brandingConfig && global.brandingConfig.embedConfig && global.brandingConfig.embedConfig.color) {
                embed.setColor(global.brandingConfig.embedConfig.color);
            }

            // Apply footer if set (but not timestamp)
            if (global.brandingConfig && global.brandingConfig.embedConfig && global.brandingConfig.embedConfig.footer) {
                embed.setFooter({ text: global.brandingConfig.embedConfig.footer });
            }

            // Create buttons for navigation
            const row = new ActionRowBuilder();

            switch(command) {
                case 'applications':
                    embed.setTitle('📝 Applications Help')
                        .setDescription('The Applications module allows you to create customizable application forms for various purposes.')
                        .addFields(
                            { name: '`/applications create`', value: 'Creates a new application panel with preset questions based on the type.\n**Options:**\n• `name`: Name of the application panel\n• `type`: Type of application (Staff, EMS, Police, Mechanic, etc.)\n• `channel`: Channel to post the application panel\n• `logs`: Channel to post application responses\n• `role`: (Optional) Role to assign to accepted applicants\n• `results`: (Optional) Channel to post acceptance/denial results' },
                            { name: '`/applications delete`', value: 'Deletes an existing application panel.\n**Options:**\n• `name`: Name of the application panel to delete' },
                            { name: '`/applications multi`', value: 'Creates a multi-panel with buttons for multiple application types.\n**Options:**\n• `channel`: Channel to post the multi-panel\n• `title`: Title for the multi-panel' },
                            { name: 'Application Types', value: 'The system supports these preset types:\n• Staff Application\n• EMS Application\n• Police Application\n• Mechanic Application\n• Partnership Application\n• Event Application' },
                            { name: 'Application Process', value: 'When a user submits an application:\n1. The application is posted in the logs channel\n2. Staff can view, accept, or deny the application\n3. The applicant receives a DM with the result\n4. If accepted and a role is configured, the user receives that role' }
                        );
                    break;

                case 'autoroles':
                    embed.setTitle('🔄 Auto Roles Help')
                        .setDescription('The Auto Roles module automatically assigns roles to new members when they join your server.')
                        .addFields(
                            { name: '`/autoroles create`', value: 'Creates a new auto role.\n**Options:**\n• `role`: The role to automatically assign to new members' },
                            { name: '`/autoroles list`', value: 'Lists all configured auto roles.' },
                            { name: '`/autoroles delete`', value: 'Deletes an auto role.\n**Options:**\n• `role`: The role to remove from auto roles' },
                            { name: 'How It Works', value: 'When a new member joins your server, they will automatically receive all roles configured as auto roles. This is useful for giving new members basic permissions or welcome roles.' }
                        );
                    break;

                case 'branding':
                    embed.setTitle('🎨 Branding Help')
                        .setDescription('The Branding module allows you to customize the bot\'s appearance and behavior.')
                        .addFields(
                            { name: '`/branding name`', value: 'Sets the bot\'s nickname in your server.\n**Options:**\n• `nickname`: The nickname to set for the bot' },
                            { name: '`/branding colour`', value: 'Sets the color for all embeds.\n**Options:**\n• `colour`: The hex color code (e.g., #FF0000 for red)' },
                            { name: '`/branding footer`', value: 'Opens a modal to set the footer text for all embeds.' },
                            { name: '`/branding banner`', value: 'Sets the banner image for embeds.\n**Options:**\n• `url`: The URL of the banner image' },
                            { name: 'Global Effects', value: 'Branding changes affect all embeds and messages sent by the bot throughout your server. This ensures a consistent look and feel across all bot features.' },
                            { name: 'Bot Status', value: 'The bot\'s status is set globally to "Watching /help | .gg/reliantt" and cannot be changed per server.' }
                        );
                    break;

                case 'embed':
                    embed.setTitle('📊 Embed Help')
                        .setDescription('The Embed module allows you to create and edit rich embeds for your server.')
                        .addFields(
                            { name: '`/embed generate`', value: 'Generates a new embed.\n**Options:**\n• `channel`: Channel to post the embed' },
                            { name: '`/embed edit`', value: 'Edits an existing embed.\n**Options:**\n• `message_id`: ID of the message containing the embed\n• `channel`: Channel containing the embed' },
                            { name: '`/embed template`', value: 'Uses pre-made embed templates.\n**Options:**\n• `type`: The type of template (Starter Tips, Donations, Greenzone Locations, Change Logs)\n• `channel`: Channel to post the embed\n\nOpens a form to edit the selected template before sending.' },
                            { name: 'Embed Creation Process', value: 'When you use the generate command:\n1. A form opens where you can set the title, description, color, and image\n2. You can add buttons and links to the embed\n3. The embed is sent to the specified channel\n4. You can later edit the embed using the edit command' },
                            { name: 'Template Features', value: 'The template command:\n• Provides pre-made templates for different purposes:\n• **Starter Tips**: Roleplay basics and guidelines for new players\n• **Donations**: Information about donations with store link\n• **Greenzone Locations**: List of safe zones in the server\n• **Change Logs**: Template for documenting server updates\n• Opens a form to customize the template before sending\n• Applies your server\'s branding color and footer' },
                            { name: 'Customization Options', value: 'Embeds support:\n• Rich text formatting\n• Custom colors\n• Images\n• Interactive buttons\n• Timestamps' }
                        );
                    break;

                case 'feedback':
                    embed.setTitle('📣 Staff Feedback Help')
                        .setDescription('The Staff Feedback module allows server members to rate and provide feedback on staff performance.')
                        .addFields(
                            { name: '`/feedback setup`', value: 'Sets up the Staff Feedback system.\n**Options:**\n• `staff_role`: The role which all of your staff members have\n• `feedback_wall`: The channel to contain the feedback wall\n• `feedback_log`: (Optional) The channel to log feedback reasons' },
                            { name: '`/staff upvote`', value: 'Upvotes a staff member.\n**Options:**\n• `staff_member`: The staff member to upvote\n• `reason`: The reason for upvoting' },
                            { name: '`/staff downvote`', value: 'Downvotes a staff member.\n**Options:**\n• `staff_member`: The staff member to downvote\n• `reason`: The reason for downvoting' },
                            { name: 'Feedback Wall', value: 'The feedback wall displays all staff members with their current ratings. It updates automatically when users upvote or downvote staff members.' },
                            { name: 'Rating System', value: 'Each staff member has a rating based on upvotes and downvotes. This provides transparency and accountability for your staff team.' }
                        );
                    break;

                case 'info':
                    embed.setTitle('📝 Bot Information Help')
                        .setDescription('The Info command displays information about the bot and provides useful links.')
                        .addFields(
                            { name: '`/info`', value: 'Displays information about the bot, including developer, library, and database details.' },
                            { name: 'Features', value: 'The info command provides:\n• Basic information about the bot\n• Links to the website and support server\n• Technical details about the bot\'s implementation' }
                        );
                    break;

                case 'gangpriority':
                    embed.setTitle('👥 Gang Priority Help')
                        .setDescription('The Gang Priority system helps manage gangs and their priority slots on your server.')
                        .addFields(
                            { name: '`/gangpriority setup`', value: 'Sets up the Gang Priority system.\n**Options:**\n• `manager_role`: Role that can manage gangs\n• `logs_channel`: Channel to log gang priority actions' },
                            { name: '`/gang create`', value: 'Creates a new gang.\n**Options:**\n• `name`: Name of the gang\n• `owner`: Owner of the gang\n• `tier`: Priority role to give to gang members\n• `slots`: Number of priority slots' },
                            { name: '`/gang upgrade`', value: 'Upgrades a gang.\n**Options:**\n• `name`: Name of the gang\n• `tier`: (Optional) New priority role\n• `slots`: (Optional) New number of slots' },
                            { name: '`/gang lookup`', value: 'Looks up information about a gang.\n**Options:**\n• `gang_name`: Name of the gang to look up' },
                            { name: '`/gang list`', value: 'Lists all gangs on the server.' },
                            { name: '`/gang delete`', value: 'Deletes a gang.\n**Options:**\n• `name`: Name of the gang to delete' },
                            { name: '`/prio add`', value: 'Adds priority to a user.\n**Options:**\n• `user`: User to add priority to' },
                            { name: '`/prio remove`', value: 'Removes priority from a user.\n**Options:**\n• `user`: User to remove priority from' },
                            { name: '`/strike add`', value: 'Adds a strike to a gang.\n**Options:**\n• `gang_name`: Name of the gang\n• `reason`: Reason for the strike' },
                            { name: '`/strike remove`', value: 'Removes a strike from a gang.\n**Options:**\n• `gang_name`: Name of the gang\n• `strike`: Index of the strike to remove' },
                            { name: '`/strike view`', value: 'Views strikes for a gang.\n**Options:**\n• `gang_name`: Name of the gang' }
                        );
                    break;

                case 'keyword':
                    embed.setTitle('🔑 Keyword Help')
                        .setDescription('The Keyword module allows you to set up automatic responses to specific keywords in messages.')
                        .addFields(
                            { name: '`/keyword create`', value: 'Creates a new keyword response.\n**Options:**\n• `name`: The keyword that triggers the response' },
                            { name: '`/keyword delete`', value: 'Deletes a keyword response.\n**Options:**\n• `name`: The keyword to delete' },
                            { name: '`/keyword list`', value: 'Lists all keyword responses.' },
                            { name: 'How It Works', value: 'When a user sends a message containing a configured keyword, the bot automatically responds with the associated response. This is useful for FAQs, rules reminders, or common information.' },
                            { name: 'Customization', value: 'When creating a keyword, you can customize:\n• The response message\n• Whether to use an embed\n• The embed title, description, and color\n• An optional image' }
                        );
                    break;

                case 'booster':
                    embed.setTitle('💎 Booster Responder Help')
                        .setDescription('The Booster Responder automatically mentions and thanks members when they boost your server.')
                        .addFields(
                            { name: '`/booster`', value: 'Configure the booster auto-responder to automatically thank users who boost your server.' },
                            { name: 'Requirements', value: 'You must have Administrator permission to use this command.\nYour server must have "Send a message when someone boosts this server" enabled in Server Settings.' },
                            { name: 'Booster Message', value: 'When someone boosts the server, they will be mentioned and receive the message:\n"Thanks for boosting the server, Enjoy your booster perks"' },
                            { name: 'Message Format', value: 'The message will be sent above an embed in the system channel with a footer showing the current boost count.' }
                        );
                    break;

                case 'mass-unban':
                    embed.setTitle('🔓 Mass Unban Help')
                        .setDescription('The Mass Unban command allows you to unban all banned members from your server at once.')
                        .addFields(
                            { name: '`/mass-unban`', value: 'Unbans all members from your server.' },
                            { name: 'Requirements', value: 'You must have Administrator permission to use this command.' },
                            { name: 'Warning', value: '⚠️ This command will unban **ALL** banned members from your server. Use with caution!' },
                            { name: 'Process', value: 'When executed:\n1. The bot fetches all banned users\n2. It unbans each user one by one\n3. It provides a summary of how many users were unbanned' }
                        );
                    break;

                case 'poll':
                    embed.setTitle('📊 Poll Help')
                        .setDescription('The Poll module allows you to create interactive polls for your server members.')
                        .addFields(
                            { name: '`/poll start`', value: 'Starts a new poll.\n**Options:**\n• `channel`: Channel to post the poll\n• `question`: The poll question\n• `option1` to `option10`: Poll options (at least 2 required)' },
                            { name: '`/poll end`', value: 'Ends an active poll.\n**Options:**\n• `message_id`: ID of the poll message\n• `channel`: Channel containing the poll' },
                            { name: 'How It Works', value: 'When you start a poll:\n1. An embed is created with the question and options\n2. Each option has a button for voting\n3. Users can click to vote for their preferred option\n4. When ended, the poll shows the final results' },
                            { name: 'Limitations', value: 'Polls can have up to 10 options, and each user can only vote for one option per poll.' }
                        );
                    break;

                case 'purge':
                    embed.setTitle('🧹 Purge Help')
                        .setDescription('The Purge command allows you to bulk delete messages from a channel.')
                        .addFields(
                            { name: '`/purge`', value: 'Deletes a specified number of messages.\n**Options:**\n• `amount`: Number of messages to delete (1-100)' },
                            { name: 'Requirements', value: 'You must have Administrator permission to use this command.' },
                            { name: 'Limitations', value: 'Due to Discord limitations:\n• You can only delete up to 100 messages at once\n• Messages older than 14 days cannot be bulk deleted\n• For older messages, you\'ll need to delete them manually' },
                            { name: 'Usage Tips', value: 'Use this command to:\n• Clean up spam\n• Remove old announcements\n• Prepare channels for new content' }
                        );
                    break;

                case 'restarts':
                    embed.setTitle('🔄 Restarts Help')
                        .setDescription('The Restarts module notifies users when your server restarts.')
                        .addFields(
                            { name: '`/restarts setup`', value: 'Sets up the Restarts Module.\n**Options:**\n• `webhook_channel`: Channel where TXAdmin sends announcements (Warnings Channel)\n• `notifications_channel`: Channel to post restart notifications\n• `server_ip`: IP address or connect link for your server' },
                            { name: '`/restarts embed`', value: 'Customizes the restart notification embed.' },
                            { name: 'How It Works', value: 'When your server restarts:\n1. TXAdmin sends an announcement to the warnings channel\n2. The bot detects the restart message\n3. It sends a custom notification to the notifications channel\n4. The notification includes your server\'s connect information' },
                            { name: 'TXAdmin Setup', value: 'Configure TXAdmin Discord integration:\n1. Go to TXAdmin Settings > Discord Bot\n2. Enter your bot token and Guild/Server ID\n3. Set the Warnings Channel ID to the channel you specified in setup\n4. TXAdmin will send restart announcements to that channel' }
                        );
                    break;

                case 'staff':
                    embed.setTitle('👮 Staff Commands Help')
                        .setDescription('Staff commands allow server members to provide feedback on staff performance.')
                        .addFields(
                            { name: '`/staff upvote`', value: 'Upvotes a staff member.\n**Options:**\n• `staff_member`: The staff member to upvote\n• `reason`: The reason for upvoting' },
                            { name: '`/staff downvote`', value: 'Downvotes a staff member.\n**Options:**\n• `staff_member`: The staff member to downvote\n• `reason`: The reason for downvoting' },
                            { name: 'Requirements', value: 'The Staff Feedback system must be set up using `/feedback setup` before these commands can be used.' },
                            { name: 'Feedback Process', value: 'When you upvote or downvote a staff member:\n1. Your feedback is recorded\n2. The staff member\'s rating is updated\n3. The feedback wall is updated\n4. If configured, the reason is logged in the feedback log channel' }
                        );
                    break;

                case 'status_blacklist':
                    embed.setTitle('🚫 Status Blacklist Help')
                        .setDescription('The Status Blacklist module allows you to automatically take action against users with blacklisted terms in their status.')
                        .addFields(
                            { name: '`/status_blacklist add`', value: 'Adds a keyword to the status blacklist.\n**Options:**\n• `keyword`: The keyword to blacklist\n• `action`: The action to take (Ban, Kick, Assign Role)\n• `role`: (Optional) The role to assign if action is "role"' },
                            { name: '`/status_blacklist del`', value: 'Removes a keyword from the status blacklist.\n**Options:**\n• `keyword`: The keyword to remove' },
                            { name: '`/status_blacklist list`', value: 'Lists all blacklisted keywords.' },
                            { name: 'How It Works', value: 'When a user joins or updates their status:\n1. The bot checks if their status contains any blacklisted terms\n2. If a match is found, the configured action is taken\n3. The action can be banning, kicking, or assigning a role to the user' },
                            { name: 'Use Cases', value: 'This feature is useful for:\n• Preventing advertising in statuses\n• Blocking inappropriate content\n• Filtering out unwanted links or server invites' }
                        );
                    break;

                case 'stickymessage':
                    embed.setTitle('📌 Sticky Message Help')
                        .setDescription('The Sticky Message module allows you to create messages that stay at the bottom of a channel.')
                        .addFields(
                            { name: '`/stickymessage create`', value: 'Creates a new sticky message.\n**Options:**\n• `channel`: The channel to create the sticky message in' },
                            { name: '`/stickymessage delete`', value: 'Deletes a sticky message.\n**Options:**\n• `channel`: The channel the sticky message is in' },
                            { name: '`/stickymessage status`', value: 'Changes the status of a sticky message.\n**Options:**\n• `channel`: The channel the sticky message is in\n• `status`: The new status (Active or Paused)' },
                            { name: 'How It Works', value: 'When you create a sticky message:\n1. A form opens where you can set the message content, embed title, description, and image\n2. The message is posted in the specified channel\n3. When new messages are sent, the sticky message is deleted and reposted to stay at the bottom\n4. You can pause or resume the sticky message using the status command' },
                            { name: 'Use Cases', value: 'Sticky messages are useful for:\n• Important announcements\n• Channel rules\n• Server information\n• Frequently asked questions' }
                        );
                    break;

                case 'tebex':
                    embed.setTitle('💰 Tebex Help')
                        .setDescription('The Tebex module integrates with your Tebex store for transaction verification.')
                        .addFields(
                            { name: '`/tebex setup`', value: 'Sets up the Tebex verification system.\n**Options:**\n• `logs_channel`: Channel to log Tebex transactions\n• `certified_role`: (Optional) Role for users who can verify transactions' },
                            { name: '`/lookup`', value: 'Looks up a Tebex transaction.\n**Options:**\n• `tebex_id`: The Tebex transaction ID' },
                            { name: '`/verify`', value: 'Verifies a Tebex transaction.\n**Options:**\n• `tebex_id`: The Tebex transaction ID' },
                            { name: 'How It Works', value: 'When a purchase is made on your Tebex store:\n1. Tebex sends a webhook notification to your server\n2. The bot logs the transaction\n3. Staff can verify the transaction using the `/verify` command\n4. Users can look up their transactions using the `/lookup` command' },
                            { name: 'Tebex Dashboard Setup', value: 'You need to configure your Tebex dashboard to send webhook notifications to Discord. The setup command provides detailed instructions.' }
                        );
                    break;

                case 'vanityroles':
                    embed.setTitle('✨ Vanity Roles Help')
                        .setDescription('The Vanity Roles module tracks and rewards users who have your server in their profile.')
                        .addFields(
                            { name: '`/vanityroles setup`', value: 'Sets up the Vanity Roles system.\n**Options:**\n• `role`: Role to give to users with your server in their profile\n• `url`: Your server\'s vanity URL (e.g., discord.gg/hville)\n• `channel`: Channel to post vanity notifications\n• `notification_type`: Where to send notifications (Log Channel, Direct Message, or Both)' },
                            { name: '`/vanityroles embed`', value: 'Customizes the vanity notification embed.' },
                            { name: 'How It Works', value: 'When a user adds your server\'s vanity URL to their profile:\n1. The bot detects the change\n2. It assigns the configured role to the user\n3. It sends a notification based on your settings\n4. If the user removes the URL, the role is automatically removed' },
                            { name: 'Benefits', value: 'This feature helps:\n• Encourage users to promote your server\n• Track which members are helping grow your community\n• Reward loyal members with special roles' }
                        );
                    break;

                case 'verification':
                    embed.setTitle('✅ Verification Help')
                        .setDescription('The Verification module adds a verification system to your server to prevent bots and raids.')
                        .addFields(
                            { name: '`/verification setup`', value: 'Sets up the Verification Module.\n**Options:**\n• `channel`: Channel to post the verification embed\n• `role`: Role to assign to verified users\n• `type`: Type of verification (Simple, FiveM Passport, Emoji Captcha, Image Captcha)' },
                            { name: '`/verification embed`', value: 'Customizes the verification embed.' },
                            { name: 'Verification Types', value: '**Simple Verification**: Users click a button to verify\n**FiveM Passport**: Users verify with their FiveM account\n**Emoji Captcha**: Users must select the correct emoji\n**Image Captcha**: Users must identify the correct image' },
                            { name: 'How It Works', value: 'When a user joins your server:\n1. They must go to the verification channel\n2. They complete the verification process based on the type you selected\n3. Upon successful verification, they receive the configured role\n4. This gives them access to the rest of your server' }
                        );
                    break;

                case 'welcome':
                    embed.setTitle('👋 Welcome Help')
                        .setDescription('The Welcome module sends customized welcome messages when new members join your server.')
                        .addFields(
                            { name: '`/welcome setup`', value: 'Sets up the Welcome system.\n**Options:**\n• `channel`: Channel to send welcome messages' },
                            { name: 'Welcome Images', value: 'The welcome system generates custom images for new members featuring:\n• The server\'s background\n• The user\'s profile picture in a circle\n• Text welcoming the user\n• The member count' },
                            { name: 'Customization', value: 'The welcome message includes:\n• A mention of the new member\n• Their member number\n• A custom welcome image\n• This helps new members feel recognized and part of the community' }
                        );
                    break;

                case 'fivemstatus':
                    embed.setTitle('📊 FiveM Status Help')
                        .setDescription('The FiveM Status module displays real-time server statistics in a channel.')
                        .addFields(
                            { name: '`/fivemstatus setup`', value: 'Sets up the FiveM Status display.\n**Options:**\n• `channel`: Channel to post the status embed\n• `cfx_code`: Your server\'s CFX code (e.g., abc123)' },
                            { name: 'Status Display', value: 'The status embed shows:\n• Server online/offline status\n• Current player count\n• Maximum player slots\n• Last refresh time\n• Connect button' },
                            { name: 'Auto-Update', value: 'The status embed automatically updates every 10 seconds with real-time data from your FiveM server.' }
                        );
                    break;

                case 'lookup':
                    embed.setTitle('🔍 Lookup Help')
                        .setDescription('The Lookup command allows you to search for Tebex transactions.')
                        .addFields(
                            { name: '`/lookup`', value: 'Looks up a Tebex transaction.\n**Options:**\n• `tebex_id`: The Tebex transaction ID to look up' },
                            { name: 'Requirements', value: 'The Tebex system must be set up using `/tebex setup` before this command can be used.' },
                            { name: 'How It Works', value: 'When you look up a transaction:\n1. The bot searches the database for the transaction ID\n2. It displays the transaction details including user, amount, and status\n3. This helps verify purchases and resolve support tickets' }
                        );
                    break;

                case 'modules':
                    embed.setTitle('🔧 Modules Help')
                        .setDescription('The Modules system allows you to enable or disable entire feature modules.')
                        .addFields(
                            { name: '`/modules enable`', value: 'Enables a disabled module.\n**Options:**\n• `module`: The module to enable' },
                            { name: '`/modules disable`', value: 'Disables a module.\n**Options:**\n• `module`: The module to disable' },
                            { name: '`/modules list`', value: 'Lists all modules and their current status.' },
                            { name: 'Available Modules', value: 'Tebex, FiveM Restarts, FiveM Status, Verification, Applications, Staff Feedback, Vanity Roles, Keyword Response, Welcome, Booster, Auto Roles, Sticky Message, Suggestion, Poll, Embed, Gang Priority, Status Blacklist, Branding, Miscellaneous' },
                            { name: 'How It Works', value: 'When you disable a module:\n• All commands associated with that module are blocked\n• Users will see an error message if they try to use a disabled command\n• You can re-enable the module at any time' }
                        );
                    break;

                case 'prio':
                    embed.setTitle('⭐ Priority Queue Help')
                        .setDescription('The Priority Queue system allows gang owners to manage priority slots for their members.')
                        .addFields(
                            { name: '`/prio add`', value: 'Adds priority to a user.\n**Options:**\n• `user`: The user to give priority to' },
                            { name: '`/prio remove`', value: 'Removes priority from a user.\n**Options:**\n• `user`: The user to remove priority from' },
                            { name: 'Requirements', value: 'The Gang Priority system must be set up using `/gangpriority setup` before this command can be used.\nYou must be a gang owner to use these commands.' },
                            { name: 'How It Works', value: 'Gang owners can:\n• Add priority roles to their gang members\n• Remove priority from members\n• Manage their allocated priority slots\n• Each gang has a limited number of slots based on their tier' }
                        );
                    break;

                case 'strike':
                    embed.setTitle('⚠️ Strikes Help')
                        .setDescription('The Strikes system allows administrators to issue warnings to gangs.')
                        .addFields(
                            { name: '`/strike add`', value: 'Adds a strike to a gang.\n**Options:**\n• `gang_name`: Name of the gang\n• `reason`: Reason for the strike' },
                            { name: '`/strike remove`', value: 'Removes a strike from a gang.\n**Options:**\n• `gang_name`: Name of the gang\n• `strike`: Index of the strike to remove' },
                            { name: '`/strike view`', value: 'Views all strikes for a gang.\n**Options:**\n• `gang_name`: Name of the gang' },
                            { name: 'Requirements', value: 'The Gang Priority system must be set up using `/gangpriority setup` before this command can be used.\nYou must have Administrator permission to use these commands.' },
                            { name: 'How It Works', value: 'Strikes are used to:\n• Track gang rule violations\n• Document warnings and infractions\n• Maintain accountability\n• Gang owners are notified when strikes are added' }
                        );
                    break;

                case 'suggestion':
                    embed.setTitle('💡 Suggestion Help')
                        .setDescription('The Suggestion module allows users to submit suggestions for your server.')
                        .addFields(
                            { name: '`/suggestion setup`', value: 'Sets up the Suggestion system.\n**Options:**\n• `channel`: Channel to post suggestions' },
                            { name: '`/suggestion submit`', value: 'Submits a new suggestion.\n**Options:**\n• `suggestion`: Your suggestion text' },
                            { name: 'How It Works', value: 'When a user submits a suggestion:\n1. It\'s posted in the suggestions channel\n2. Other users can upvote (👍) or downvote (👎) the suggestion\n3. Staff can see which suggestions are most popular\n4. This helps gather community feedback' },
                            { name: 'Voting', value: 'Each suggestion has reaction buttons for voting. Users can change their vote at any time by clicking a different reaction.' }
                        );
                    break;

                default:
                    // Main help menu
                    embed.setTitle('📚 Bot Help Menu')
                        .setDescription('Welcome to the help system! Select a command category below to learn more, or use `/help command:category` for specific help.')
                        .addFields(
                            { name: '🛠️ Administration', value: '`/autoroles` - Auto role assignment\n`/booster` - Server boost responder\n`/branding` - Bot appearance customization\n`/mass-unban` - Unban all members\n`/modules` - Enable/disable modules\n`/purge` - Bulk delete messages\n`/status_blacklist` - Filter inappropriate statuses' },
                            { name: '🤝 Community', value: '`/applications` - Application forms\n`/feedback` - Staff feedback system\n`/poll` - Create community polls\n`/staff` - Rate staff members\n`/suggestion` - Submit suggestions\n`/verification` - Server verification' },
                            { name: '📢 Content', value: '`/embed` - Create rich embeds\n`/keyword` - Automatic responses\n`/stickymessage` - Pinned channel messages\n`/welcome` - Welcome new members' },
                            { name: '🎮 FiveM & Gaming', value: '`/fivemstatus` - Server status display\n`/gangpriority` - Manage gang priorities\n`/lookup` - Look up Tebex transactions\n`/prio` - Manage priority queue\n`/restarts` - Server restart notifications\n`/strike` - Gang strike system\n`/tebex` - Store integration\n`/vanityroles` - Reward server promotion' },
                            { name: 'ℹ️ Information', value: '`/info` - Bot information\n`/help` - This help menu' },
                            { name: '📋 Command Usage', value: 'Use `/help command:category` to see detailed help for a specific command category.' }
                        );

                    // Add navigation buttons
                    const adminButton = new ButtonBuilder()
                        .setCustomId('help_admin')
                        .setLabel('Administration')
                        .setStyle(ButtonStyle.Primary);

                    const communityButton = new ButtonBuilder()
                        .setCustomId('help_community')
                        .setLabel('Community')
                        .setStyle(ButtonStyle.Success);

                    const contentButton = new ButtonBuilder()
                        .setCustomId('help_content')
                        .setLabel('Content')
                        .setStyle(ButtonStyle.Secondary);

                    const gamingButton = new ButtonBuilder()
                        .setCustomId('help_gaming')
                        .setLabel('Gaming')
                        .setStyle(ButtonStyle.Danger);

                    row.addComponents(adminButton, communityButton, contentButton, gamingButton);
                    break;
            }

            return { embed, row };
        };

        // Generate the appropriate help embed
        const { embed, row } = createHelpEmbed(specificCommand);

        // Send the help message with navigation buttons if on main menu
        if (!specificCommand) {
            await interaction.reply({
                embeds: [embed],
                components: [row],
                ephemeral: true
            });

            // Create a collector for button interactions
            const filter = i => i.user.id === interaction.user.id && i.customId.startsWith('help_');
            const collector = interaction.channel.createMessageComponentCollector({ filter, time: 300000 }); // 5 minutes

            collector.on('collect', async i => {
                const category = i.customId.replace('help_', '');

                // Handle back button
                if (category === 'back') {
                    // Generate main help embed
                    const { embed: mainEmbed, row: mainRow } = createHelpEmbed();

                    // Update the message with main menu
                    await i.update({
                        embeds: [mainEmbed],
                        components: [mainRow]
                    });
                    return;
                }

                let commandToShow = '';

                // Map category to specific command
                switch(category) {
                    case 'admin':
                        commandToShow = ['autoroles', 'booster', 'branding', 'mass-unban', 'purge', 'status_blacklist'][Math.floor(Math.random() * 6)];
                        break;
                    case 'community':
                        commandToShow = ['applications', 'feedback', 'poll', 'staff', 'verification'][Math.floor(Math.random() * 5)];
                        break;
                    case 'content':
                        commandToShow = ['embed', 'keyword', 'stickymessage', 'welcome'][Math.floor(Math.random() * 4)];
                        break;
                    case 'gaming':
                        commandToShow = ['gangpriority', 'restarts', 'tebex', 'vanityroles'][Math.floor(Math.random() * 4)];
                        break;
                }

                // Generate new help embed
                const { embed: newEmbed } = createHelpEmbed(commandToShow);

                // Create back button
                const backButton = new ButtonBuilder()
                    .setCustomId('help_back')
                    .setLabel('Back to Main Menu')
                    .setStyle(ButtonStyle.Secondary);

                const backRow = new ActionRowBuilder().addComponents(backButton);

                // Update the message
                await i.update({
                    embeds: [newEmbed],
                    components: [backRow]
                });
            });
        } else {
            // For specific command help, just send the embed without buttons
            await interaction.reply({
                embeds: [embed],
                ephemeral: true
            });
        }

        return;
    }

    if (commandName === 'tebex') {
        const subcommand = options.getSubcommand();
        const guildId = interaction.guild.id;

        if (subcommand === 'setup') {
            const logsChannel = options.getChannel('logs_channel');
            const certifiedRole = options.getRole('certified_role');

            try {
                // Find or create Tebex config
                await TebexConfig.findOneAndUpdate(
                    { guildId },
                    {
                        guildId,
                        logsChannelId: logsChannel.id,
                        certifiedRoleId: certifiedRole?.id,
                        enabled: true
                    },
                    { upsert: true, new: true }
                );

                // Create a webhook for the logs channel
                const webhook = await logsChannel.createWebhook({
                    name: 'Tebex Verification',
                    avatar: 'https://cdn.discordapp.com/attachments/1234567890/1234567890/tebex.png'
                });

                // Update the config with the webhook info
                await TebexConfig.findOneAndUpdate(
                    { guildId },
                    {
                        webhookId: webhook.id,
                        webhookToken: webhook.token
                    }
                );

                // Create a success embed
                const embed = new EmbedBuilder()
                    .setTitle('Tebex Verification Setup')
                    .setDescription('Tebex verification system has been set up successfully!')
                    .addFields(
                        { name: 'Logs Channel', value: `${logsChannel}`, inline: true },
                        { name: 'Certified Role', value: certifiedRole ? `${certifiedRole}` : 'None', inline: true }
                    )
                    .setColor('#57F287') // Green
                    .setFooter({ text: 'Make sure to set up the webhook in your Tebex dashboard' })
                    .setTimestamp();

                // Add instructions for Tebex dashboard setup
                const instructionsEmbed = new EmbedBuilder()
                    .setTitle('Tebex Dashboard Setup Instructions')
                    .setDescription('Follow these steps to complete the setup in your Tebex dashboard:')
                    .addFields(
                        {
                            name: '1. Go to Tebex Dashboard',
                            value: 'Navigate to the Webstore => Notifications tab.'
                        },
                        {
                            name: '2. Select Discord',
                            value: 'Click on Discord in the notification options.'
                        },
                        {
                            name: '3. Configure Payment Received Event',
                            value: 'For the Payment Received event, use this template:\n```{webstore} has received a payment ╽ From: {username} ╽ Price: {price} ╽ Package: {packagename} ╽ Transaction ID: {transactionid} ╽ Email: {EMAIL}```'
                        },
                        {
                            name: '4. Configure Payment Chargeback Event',
                            value: 'For the Payment Chargeback event, use this template:\n```{webstore} has received a chargeback ╽ From: {username} ╽ Price: {price} ╽ Package: {packagename} ╽ Transaction ID: {transactionid} ╽ Email: {EMAIL}```'
                        },
                        {
                            name: '5. Set Webhook URL',
                            value: `Use this webhook URL:\n\`${webhook.url}\``
                        }
                    )
                    .setColor('#5865F2') // Discord Blue
                    .setTimestamp();

                return interaction.reply({
                    embeds: [embed, instructionsEmbed],
                    ephemeral: true
                });
            } catch (error) {
                console.error('Error setting up Tebex verification:', error);
                return interaction.reply({
                    content: 'An error occurred while setting up the Tebex verification system.',
                    ephemeral: true
                });
            }
        }
    }

    else if (commandName === 'lookup') {
        const tebexId = options.getString('tebex_id');
        const guildId = interaction.guild.id;

        try {
            // Check if Tebex verification is set up
            const tebexConfig = await TebexConfig.findOne({ guildId });
            if (!tebexConfig || !tebexConfig.enabled) {
                return interaction.reply({
                    content: 'Tebex verification is not set up for this server. Please ask an administrator to run `/tebex setup`.',
                    ephemeral: true
                });
            }

            // Check if user has permission to use this command
            const hasPermission = interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages) ||
                (tebexConfig.certifiedRoleId && interaction.member.roles.cache.has(tebexConfig.certifiedRoleId));

            if (!hasPermission) {
                return interaction.reply({
                    content: 'You do not have permission to use this command. You need either Manage Messages permission or the Tebex Certified role.',
                    ephemeral: true
                });
            }

            // Find the transaction
            const transaction = await TebexTransaction.findOne({ guildId, transactionId: tebexId });
            if (!transaction) {
                return interaction.reply({
                    content: `No transaction found with ID ${tebexId}. This transaction may not exist or has not been processed yet.`,
                    ephemeral: true
                });
            }

            // Create an embed with the transaction details
            const embed = new EmbedBuilder()
                .setTitle(`\`📃\`Tebex Transaction: ${tebexId}`)
                .addFields(
                    { name: '**Username**', value: transaction.username || 'Unknown', inline: true },
                    { name: '**Package**', value: transaction.packageName || 'Unknown', inline: true },
                    { name: '**Price**', value: transaction.price || 'Unknown', inline: true },
                    { name: '**Verified**', value: transaction.verified ? 'Yes' : 'No', inline: true },
                    { name: '**Transaction Date**', value: new Date(transaction.createdAt).toLocaleString(), inline: true }
                )
                .setColor(transaction.verified ? '#57F287' : '#FEE75C') // Green if verified, yellow if not
                .setFooter({ text: `Transaction ID: ${tebexId}` })
                .setTimestamp();

            // Add verification details if verified
            if (transaction.verified) {
                const verifier = await interaction.guild.members.fetch(transaction.verifiedBy).catch(() => null);
                embed.addFields(
                    { name: 'Verified By', value: verifier ? verifier.toString() : 'Unknown', inline: true },
                    { name: 'Verified At', value: new Date(transaction.verifiedAt).toLocaleString(), inline: true }
                );
            }

            return interaction.reply({
                embeds: [embed],
                ephemeral: true
            });
        } catch (error) {
            console.error('Error looking up Tebex transaction:', error);
            return interaction.reply({
                content: 'An error occurred while looking up the Tebex transaction.',
                ephemeral: true
            });
        }
    }

    else if (commandName === 'verify') {
        const tebexId = options.getString('tebex_id');
        const guildId = interaction.guild.id;

        try {
            // Check if Tebex verification is set up
            const tebexConfig = await TebexConfig.findOne({ guildId });
            if (!tebexConfig || !tebexConfig.enabled) {
                return interaction.reply({
                    content: 'Tebex verification is not set up for this server. Please ask an administrator to run `/tebex setup`.',
                    ephemeral: true
                });
            }

            // Check if user has permission to use this command
            const hasPermission = interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages) ||
                (tebexConfig.certifiedRoleId && interaction.member.roles.cache.has(tebexConfig.certifiedRoleId));

            if (!hasPermission) {
                return interaction.reply({
                    content: 'You do not have permission to use this command. You need either Manage Messages permission or the Tebex Certified role.',
                    ephemeral: true
                });
            }

            // Find the transaction
            const transaction = await TebexTransaction.findOne({ guildId, transactionId: tebexId });
            if (!transaction) {
                return interaction.reply({
                    content: `No transaction found with ID ${tebexId}. This transaction may not exist or has not been processed yet.`,
                    ephemeral: true
                });
            }

            // Check if already verified
            if (transaction.verified) {
                const verifier = await interaction.guild.members.fetch(transaction.verifiedBy).catch(() => null);
                return interaction.reply({
                    content: `This transaction has already been verified by ${verifier ? verifier.toString() : 'a staff member'} on ${new Date(transaction.verifiedAt).toLocaleString()}.`,
                    ephemeral: true
                });
            }

            // Mark as verified
            transaction.verified = true;
            transaction.verifiedBy = interaction.user.id;
            transaction.verifiedAt = new Date();
            await transaction.save();

            // Get the logs channel
            const logsChannel = await interaction.guild.channels.fetch(tebexConfig.logsChannelId).catch(() => null);

            // Create an embed for the verification
            const embed = new EmbedBuilder()
                .setTitle(`\`✅\`**Tebex Transaction Verified:** ${tebexId}`)
                .setDescription(`Transaction has been verified by ${interaction.user}.`)
                .addFields(
                    { name: '**Username**', value: transaction.username || 'Unknown', inline: true },
                    { name: '**Package**', value: transaction.packageName || 'Unknown', inline: true },
                    { name: '**Price**', value: transaction.price || 'Unknown', inline: true },
                    { name: '**Verified By**', value: interaction.user.toString(), inline: true },
                    { name: '**Verified At**', value: new Date().toLocaleString(), inline: true }
                )
                .setColor('#57F287') // Green
                .setFooter({ text: `Transaction ID: ${tebexId}` })
                .setTimestamp();

            // Send verification log to the logs channel
            if (logsChannel) {
                await logsChannel.send({ embeds: [embed] });
            }

            return interaction.reply({
                content: `Transaction ${tebexId} has been verified successfully.`,
                embeds: [embed],
                ephemeral: true
            });
        } catch (error) {
            console.error('Error verifying Tebex transaction:', error);
            return interaction.reply({
                content: 'An error occurred while verifying the Tebex transaction.',
                ephemeral: true
            });
        }
    }

    else if (commandName === 'purge') {
        const amount = options.getInteger('amount');
        const targetChannel = options.getChannel('channel') || interaction.channel;

        // Check if amount is valid
        if (amount <= 0 || amount > 100) {
            return interaction.reply({
                content: 'Please provide a number between 1 and 100.',
                ephemeral: true
            });
        }

        try {
            // Defer the reply to give time for the operation to complete
            await interaction.deferReply({ ephemeral: true });

            // Fetch and delete messages
            const messages = await targetChannel.messages.fetch({ limit: amount });
            const messagesToDelete = messages.filter(msg => msg.createdTimestamp > Date.now() - 1209600000); // 14 days in milliseconds

            if (messagesToDelete.size === 0) {
                return interaction.editReply({
                    content: 'No messages found that can be deleted. Messages older than 14 days cannot be bulk deleted.',
                    ephemeral: true
                });
            }

            // Bulk delete messages
            const deleted = await targetChannel.bulkDelete(messagesToDelete, true);

            // Send confirmation
            return interaction.editReply({
                content: `Successfully deleted ${deleted.size} message${deleted.size === 1 ? '' : 's'} in ${targetChannel}.`,
                ephemeral: true
            });
        } catch (error) {
            console.error('Error purging messages:', error);
            return interaction.editReply({
                content: 'An error occurred while trying to delete messages. Messages older than 14 days cannot be bulk deleted.',
                ephemeral: true
            });
        }
    }

    else if (commandName === 'role') {
        const user = options.getUser('user');
        const role = options.getRole('role');

        try {
            // Get the member object
            const member = await interaction.guild.members.fetch(user.id).catch(() => null);

            if (!member) {
                return interaction.reply({
                    content: 'User not found in this server.',
                    ephemeral: true
                });
            }

            // Check if the member already has the role
            if (member.roles.cache.has(role.id)) {
                return interaction.reply({
                    content: `${user.tag} already has the ${role.name} role.`,
                    ephemeral: true
                });
            }

            // Check if the bot can manage this role
            const botMember = interaction.guild.members.me;
            if (role.position >= botMember.roles.highest.position) {
                return interaction.reply({
                    content: 'I cannot manage this role as it is higher or equal to my highest role.',
                    ephemeral: true
                });
            }

            // Add the role
            await member.roles.add(role, `Added by ${interaction.user.tag}`);

            // Create success embed
            const embed = new EmbedBuilder()
                .setTitle('✅ Role Added')
                .setDescription(`Successfully added ${role} to ${user}`)
                .setColor('#57F287') // Green
                .addFields(
                    { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
                    { name: 'Role', value: `${role.name}`, inline: true },
                    { name: 'Added By', value: interaction.user.tag, inline: true }
                )
                .setTimestamp();

            // Apply branding
            applyBranding(embed);

            return interaction.reply({
                embeds: [embed]
            });
        } catch (error) {
            console.error('Error adding role:', error);
            return interaction.reply({
                content: 'An error occurred while trying to add the role.',
                ephemeral: true
            });
        }
    }

    else if (commandName === 'ban') {
        const user = options.getUser('user');
        const reason = options.getString('reason') || 'No reason provided';
        const deleteMessageDays = options.getInteger('delete_messages') || 7;

        try {
            // Validate delete_messages parameter
            if (deleteMessageDays < 0 || deleteMessageDays > 7) {
                return interaction.reply({
                    content: 'Delete messages days must be between 0 and 7.',
                    ephemeral: true
                });
            }

            // Check if user is bannable
            const member = await interaction.guild.members.fetch(user.id).catch(() => null);

            if (member) {
                // Check if the bot can ban this member
                const botMember = interaction.guild.members.me;
                if (member.roles.highest.position >= botMember.roles.highest.position) {
                    return interaction.reply({
                        content: 'I cannot ban this user as their highest role is higher or equal to mine.',
                        ephemeral: true
                    });
                }

                // Check if user is trying to ban themselves
                if (member.id === interaction.user.id) {
                    return interaction.reply({
                        content: 'You cannot ban yourself.',
                        ephemeral: true
                    });
                }

                // Check if user is trying to ban the bot
                if (member.id === client.user.id) {
                    return interaction.reply({
                        content: 'I cannot ban myself.',
                        ephemeral: true
                    });
                }
            }

            // Try to DM the user before banning
            try {
                const dmEmbed = new EmbedBuilder()
                    .setTitle('🔨 You have been banned')
                    .setDescription(`You have been banned from **${interaction.guild.name}**`)
                    .addFields(
                        { name: 'Reason', value: reason },
                        { name: 'Banned by', value: interaction.user.tag }
                    )
                    .setColor('#ED4245') // Red
                    .setTimestamp();

                await user.send({ embeds: [dmEmbed] }).catch(() => {
                    console.log(`Could not DM ${user.tag} about their ban`);
                });
            } catch (error) {
                console.log(`Could not DM ${user.tag} about their ban`);
            }

            // Ban the user
            await interaction.guild.members.ban(user, {
                deleteMessageSeconds: deleteMessageDays * 24 * 60 * 60,
                reason: `${reason} | Banned by ${interaction.user.tag}`
            });

            // Create success embed
            const embed = new EmbedBuilder()
                .setTitle('🔨 User Banned')
                .setDescription(`Successfully banned ${user.tag}`)
                .setColor('#ED4245') // Red
                .addFields(
                    { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
                    { name: 'Reason', value: reason, inline: true },
                    { name: 'Banned By', value: interaction.user.tag, inline: true },
                    { name: 'Messages Deleted', value: `${deleteMessageDays} day${deleteMessageDays === 1 ? '' : 's'}`, inline: true }
                )
                .setTimestamp();

            // Apply branding
            applyBranding(embed);

            return interaction.reply({
                embeds: [embed]
            });
        } catch (error) {
            console.error('Error banning user:', error);
            return interaction.reply({
                content: `An error occurred while trying to ban the user: ${error.message}`,
                ephemeral: true
            });
        }
    }

    else if (commandName === 'poll') {
        const subcommand = options.getSubcommand();
        const guildId = interaction.guild.id;

        if (subcommand === 'start') {
            // Create a modal for the poll creation
            const modal = new ModalBuilder()
                .setCustomId('poll_create')
                .setTitle('Create a Poll');

            // Question input
            const questionInput = new TextInputBuilder()
                .setCustomId('poll_question')
                .setLabel('Poll Question')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true)
                .setPlaceholder('What would you like to ask the community?');

            // Add inputs to modal
            modal.addComponents(
                new ActionRowBuilder().addComponents(questionInput)
            );

            await interaction.showModal(modal);
            return;
        }
        else if (subcommand === 'end') {
            const messageId = options.getString('message_id');

            try {
                // Find the poll
                const poll = await Poll.findOne({ messageId, guildId });
                if (!poll) {
                    return interaction.reply({
                        content: 'No active poll found with that message ID.',
                        ephemeral: true
                    });
                }

                if (!poll.active) {
                    return interaction.reply({
                        content: 'This poll has already been ended.',
                        ephemeral: true
                    });
                }

                // Get the channel and message
                const channel = await interaction.guild.channels.fetch(poll.channelId).catch(() => null);
                if (!channel) {
                    return interaction.reply({
                        content: 'The channel containing this poll no longer exists.',
                        ephemeral: true
                    });
                }

                const message = await channel.messages.fetch(messageId).catch(() => null);
                if (!message) {
                    return interaction.reply({
                        content: 'The poll message no longer exists.',
                        ephemeral: true
                    });
                }

                // Mark the poll as inactive
                poll.active = false;
                poll.endedAt = new Date();
                await poll.save();

                // Create results embed
                const upvotes = poll.upvotes.length;
                const downvotes = poll.downvotes.length;
                const totalVotes = upvotes + downvotes;

                // If no votes, delete the poll
                if (totalVotes === 0) {
                    await message.delete();
                    return interaction.reply({
                        content: 'Poll ended and deleted (no votes were cast).',
                        ephemeral: true
                    });
                }

                const upvotePercentage = totalVotes > 0 ? Math.round((upvotes / totalVotes) * 100) : 0;
                const downvotePercentage = totalVotes > 0 ? Math.round((downvotes / totalVotes) * 100) : 0;

                const resultsEmbed = new EmbedBuilder()
                    .setTitle(`\`\`${poll.question}\`\``)
                    .setDescription(`This poll has ended.`)
                    .addFields(
                        { name: '👍 Upvotes', value: `${upvotes} (${upvotePercentage}%)`, inline: true },
                        { name: '👎 Downvotes', value: `${downvotes} (${downvotePercentage}%)`, inline: true },
                        { name: 'Total Votes', value: `${totalVotes}`, inline: true }
                    )
                    .setColor('#5865F2') // Discord Blue
                    .setFooter({ text: `Poll ended by ${interaction.user.tag}` })
                    .setTimestamp();

                // Update the message with results
                await message.edit({
                    embeds: [resultsEmbed],
                    components: [] // Remove buttons
                });

                return interaction.reply({
                    content: `Poll ended successfully. Results are displayed in ${channel}.`,
                    ephemeral: true
                });
            } catch (error) {
                console.error('Error ending poll:', error);
                return interaction.reply({
                    content: 'An error occurred while ending the poll.',
                    ephemeral: true
                });
            }
        }
    }

    else if (commandName === 'suggestion') {
        const suggestionText = options.getString('suggestion');
        const guildId = interaction.guild.id;

        try {
            // Reply immediately to prevent timeout
            await interaction.reply({
                content: 'Your suggestion has been submitted!',
                ephemeral: true
            });

            // Create the suggestion embed with the new format
            const suggestionEmbed = new EmbedBuilder()
                .setTitle('New Suggestion')
                .setDescription(suggestionText)
                .setColor('#5865F2')
                .addFields(
                    { name: 'Upvotes', value: '0', inline: true },
                    { name: 'Downvotes', value: '0', inline: true }
                )
                .setFooter({ text: `Suggested by ${interaction.user.username}` })
                .setTimestamp();

            // Create buttons for upvote and downvote
            const upvoteButton = new ButtonBuilder()
                .setCustomId(`suggestion_upvote_${interaction.user.id}`)
                .setLabel('Upvoted (0)')
                .setStyle(ButtonStyle.Success);

            const downvoteButton = new ButtonBuilder()
                .setCustomId(`suggestion_downvote_${interaction.user.id}`)
                .setLabel('Downvoted (0)')
                .setStyle(ButtonStyle.Danger);

            const row = new ActionRowBuilder()
                .addComponents(upvoteButton, downvoteButton);

            // Send the suggestion embed with buttons
            const suggestionMessage = await interaction.channel.send({
                embeds: [suggestionEmbed],
                components: [row]
            });

            // Save to database if connected
            try {
                if (db.isConnected()) {
                    await Suggestion.create({
                        guildId,
                        channelId: interaction.channel.id,
                        messageId: suggestionMessage.id,
                        suggestion: suggestionText,
                        userId: interaction.user.id,
                        upvotes: [],
                        downvotes: []
                    });
                }
            } catch (dbError) {
                console.error('Error saving suggestion to database:', dbError);
                // Continue anyway - suggestion is posted
            }
        } catch (error) {
            console.error('Error creating suggestion:', error);
            // Try to reply if we haven't already
            try {
                if (!interaction.replied) {
                    return interaction.reply({
                        content: 'An error occurred while submitting your suggestion.',
                        ephemeral: true
                    });
                }
            } catch (replyError) {
                console.error('Error sending error reply:', replyError);
            }
        }
    }

    else if (commandName === 'stickymessage') {
        const subcommand = options.getSubcommand();
        const guildId = interaction.guild.id;

        // Check if database is connected
        if (!db.isConnected()) {
            return interaction.reply({
                content: 'This command requires database access, but the database is currently unavailable. Please try again later.',
                ephemeral: true
            });
        }

        if (subcommand === 'create') {
            const channel = options.getChannel('channel');

            // Check if the channel is a text channel
            if (channel.type !== ChannelType.GuildText) {
                return interaction.reply({
                    content: 'Sticky messages can only be created in text channels.',
                    ephemeral: true
                });
            }

            // Check if there's already an active sticky message in this channel
            const existingActiveSticky = await safeDbOperation(
                () => StickyMessage.findOne({ guildId, channelId: channel.id, active: true }),
                null
            );

            if (existingActiveSticky) {
                return interaction.reply({
                    content: `There is already an active sticky message in ${channel}. Please pause it before creating a new one.`,
                    ephemeral: true
                });
            }

            // Create a modal for the sticky message with all required fields
            const modal = new ModalBuilder()
                .setCustomId(`sticky_create_${channel.id}`)
                .setTitle('Create Sticky Message');

            // Add message content input
            const contentInput = new TextInputBuilder()
                .setCustomId('sticky_content')
                .setLabel('Message Content')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('Enter the content of your sticky message here...')
                .setRequired(true)
                .setMaxLength(2000);

            // Add embed title input
            const embedTitleInput = new TextInputBuilder()
                .setCustomId('embed_title')
                .setLabel('Embed Title')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Enter a title for the embed (optional)')
                .setRequired(false)
                .setMaxLength(256);

            // Add embed description input
            const embedDescInput = new TextInputBuilder()
                .setCustomId('embed_description')
                .setLabel('Embed Description')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('Enter a description for the embed (optional)')
                .setRequired(false)
                .setMaxLength(4000);

            // Add embed image URL input
            const embedImageInput = new TextInputBuilder()
                .setCustomId('embed_image')
                .setLabel('Embed Image URL')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Enter an image URL for the embed (optional)')
                .setRequired(false);

            // Add all inputs to the modal (maximum 5 components)
            modal.addComponents(
                new ActionRowBuilder().addComponents(contentInput),
                new ActionRowBuilder().addComponents(embedTitleInput),
                new ActionRowBuilder().addComponents(embedDescInput),
                new ActionRowBuilder().addComponents(embedImageInput)
            );

            // Show the modal to the user
            return interaction.showModal(modal);
        }
        else if (subcommand === 'delete') {
            const channel = options.getChannel('channel');

            try {
                // Find the active sticky message in the channel
                const stickyMessage = await StickyMessage.findOne({ guildId, channelId: channel.id, active: true });
                if (!stickyMessage) {
                    return interaction.reply({
                        content: `No active sticky message found in ${channel}.`,
                        ephemeral: true
                    });
                }

                // Get the title for the success message
                const title = stickyMessage.embedData?.title || stickyMessage.title;

                // Delete the sticky message from the database
                await StickyMessage.deleteOne({ _id: stickyMessage._id });

                // Try to delete the last sticky message from the channel
                if (stickyMessage.lastMessageId) {
                    try {
                        const messageChannel = await client.channels.fetch(stickyMessage.channelId);
                        const message = await messageChannel.messages.fetch(stickyMessage.lastMessageId).catch(() => null);
                        if (message) {
                            await message.delete().catch(() => null);
                        }
                    } catch (error) {
                        console.error('Error deleting sticky message from channel:', error);
                    }
                }

                // Create a success embed
                const embed = new EmbedBuilder()
                    .setTitle('Sticky Message Deleted')
                    .setDescription(`The sticky message "${title}" has been deleted from ${channel}.`)
                    .setColor('#ED4245') // Red
                    .setTimestamp();

                // Apply branding
                applyBranding(embed);

                return interaction.reply({
                    embeds: [embed],
                    ephemeral: true // Only visible to the user who ran the command
                });
            } catch (error) {
                console.error('Error deleting sticky message:', error);
                return interaction.reply({
                    content: 'An error occurred while deleting the sticky message.',
                    ephemeral: true
                });
            }
        }
        else if (subcommand === 'status') {
            const channel = options.getChannel('channel');
            const status = options.getString('status');
            const isActive = status === 'active';

            try {
                // Find the sticky message in the channel
                const stickyMessage = await StickyMessage.findOne({ guildId, channelId: channel.id });
                if (!stickyMessage) {
                    return interaction.reply({
                        content: `No sticky message found in ${channel}.`,
                        ephemeral: true
                    });
                }

                // Title is no longer needed for the success message

                // Check if there's already an active sticky message in this channel
                if (isActive) {
                    const existingActiveSticky = await StickyMessage.findOne({
                        guildId,
                        channelId: channel.id,
                        active: true,
                        _id: { $ne: stickyMessage._id }
                    });

                    if (existingActiveSticky) {
                        return interaction.reply({
                            content: `There is already an active sticky message in ${channel}. Please pause it before activating this one.`,
                            ephemeral: true
                        });
                    }
                }

                // Update the sticky message status
                stickyMessage.active = isActive;
                stickyMessage.updatedAt = new Date();
                await stickyMessage.save();

                // If activating, post the sticky message
                if (isActive) {
                    try {
                        const messageChannel = await client.channels.fetch(stickyMessage.channelId);

                        // Create the sticky message embed
                        const embed = new EmbedBuilder()
                            .setColor('#5865F2') // Discord Blue
                            .setFooter({ text: 'Sticky Message' })
                            .setTimestamp();

                        // Set title based on embedData if available
                        if (stickyMessage.embedData && stickyMessage.embedData.title) {
                            embed.setTitle(stickyMessage.embedData.title);
                        } else {
                            embed.setTitle(stickyMessage.title);
                        }

                        // Set description based on embedData if available
                        if (stickyMessage.embedData && stickyMessage.embedData.description) {
                            embed.setDescription(stickyMessage.embedData.description);
                        } else {
                            embed.setDescription(stickyMessage.content);
                        }

                        // Set image if available in embedData
                        if (stickyMessage.embedData && stickyMessage.embedData.image && stickyMessage.embedData.image.trim() !== '') {
                            try {
                                // Validate URL format
                                new URL(stickyMessage.embedData.image);
                                embed.setImage(stickyMessage.embedData.image);
                            } catch (error) {
                                console.error('Invalid image URL for sticky message:', error);
                            }
                        }

                        // Apply branding
                        applyBranding(embed);

                        // Prepare message content and embed
                        const messageOptions = {};

                        // Add content if it exists and is different from embed description
                        if (stickyMessage.content &&
                            (!stickyMessage.embedData?.description ||
                             stickyMessage.content !== stickyMessage.embedData.description)) {
                            messageOptions.content = stickyMessage.content;
                        }

                        // Add embed
                        messageOptions.embeds = [embed];

                        // Send the sticky message
                        const message = await messageChannel.send(messageOptions);

                        // Update the last message ID
                        stickyMessage.lastMessageId = message.id;
                        await stickyMessage.save();
                    } catch (error) {
                        console.error('Error posting sticky message:', error);
                    }
                } else {
                    // If deactivating, try to delete the last sticky message
                    if (stickyMessage.lastMessageId) {
                        try {
                            const messageChannel = await client.channels.fetch(stickyMessage.channelId);
                            const message = await messageChannel.messages.fetch(stickyMessage.lastMessageId).catch(() => null);
                            if (message) {
                                await message.delete().catch(() => null);
                            }

                            // Clear the last message ID
                            stickyMessage.lastMessageId = null;
                            await stickyMessage.save();
                        } catch (error) {
                            console.error('Error deleting sticky message from channel:', error);
                        }
                    }
                }

                // Create a success embed
                const embed = new EmbedBuilder()
                    .setTitle('Sticky Message Status Updated')
                    .setDescription(`The sticky message in ${channel} is now ${isActive ? 'active' : 'paused'}.`)
                    .setColor(isActive ? '#57F287' : '#FEE75C') // Green if active, yellow if paused
                    .setTimestamp();

                // Apply branding
                applyBranding(embed);

                return interaction.reply({
                    embeds: [embed],
                    ephemeral: true // Only visible to the user who ran the command
                });
            } catch (error) {
                console.error('Error updating sticky message status:', error);
                return interaction.reply({
                    content: 'An error occurred while updating the sticky message status.',
                    ephemeral: true
                });
            }
        }
    }

    else if (commandName === 'autoroles') {
        const subcommand = options.getSubcommand();
        const guildId = interaction.guild.id;

        if (subcommand === 'create') {
            const role = options.getRole('role');

            try {
                // Check if the role is already an auto role
                const existingAutoRole = await AutoRole.findOne({ guildId, roleId: role.id });
                if (existingAutoRole) {
                    return interaction.reply({
                        content: `${role} is already set as an auto role.`,
                        ephemeral: true
                    });
                }

                // Create the auto role
                await AutoRole.create({
                    guildId,
                    roleId: role.id,
                    addedBy: interaction.user.id
                });

                // Create a success embed
                const embed = new EmbedBuilder()
                    .setTitle('Auto Role Created')
                    .setDescription(`${role} will now be automatically assigned to new members when they join the server.`)
                    .setColor('#57F287') // Green
                    .setTimestamp();

                // Apply branding
                applyBranding(embed);

                return interaction.reply({
                    embeds: [embed],
                    ephemeral: false // Make this visible to everyone
                });
            } catch (error) {
                console.error('Error creating auto role:', error);
                return interaction.reply({
                    content: 'An error occurred while creating the auto role.',
                    ephemeral: true
                });
            }
        }
        else if (subcommand === 'list') {
            try {
                // Get all auto roles for this guild
                const autoRoles = await AutoRole.find({ guildId });

                if (autoRoles.length === 0) {
                    return interaction.reply({
                        content: 'There are no auto roles set up for this server.',
                        ephemeral: true
                    });
                }

                // Create an embed to display the auto roles
                const embed = new EmbedBuilder()
                    .setTitle('Auto Roles')
                    .setDescription(`This server has ${autoRoles.length} auto role${autoRoles.length === 1 ? '' : 's'}.`)
                    .setColor('#5865F2') // Discord Blue
                    .setTimestamp();

                // Add each auto role as a field
                for (const autoRole of autoRoles) {
                    const role = await interaction.guild.roles.fetch(autoRole.roleId).catch(() => null);
                    const addedBy = await interaction.guild.members.fetch(autoRole.addedBy).catch(() => null);

                    embed.addFields({
                        name: role ? role.name : 'Unknown Role',
                        value: `Role: ${role ? role.toString() : 'Role not found'}\nAdded by: ${addedBy ? addedBy.toString() : 'Unknown'}\nAdded on: ${new Date(autoRole.addedAt).toLocaleString()}`
                    });
                }

                // Apply branding
                applyBranding(embed);

                return interaction.reply({
                    embeds: [embed],
                    ephemeral: true
                });
            } catch (error) {
                console.error('Error listing auto roles:', error);
                return interaction.reply({
                    content: 'An error occurred while listing the auto roles.',
                    ephemeral: true
                });
            }
        }
        else if (subcommand === 'delete') {
            const role = options.getRole('role');

            try {
                // Check if the role is an auto role
                const autoRole = await AutoRole.findOne({ guildId, roleId: role.id });
                if (!autoRole) {
                    return interaction.reply({
                        content: `${role} is not set as an auto role.`,
                        ephemeral: true
                    });
                }

                // Delete the auto role
                await AutoRole.deleteOne({ guildId, roleId: role.id });

                // Create a success embed
                const embed = new EmbedBuilder()
                    .setTitle('Auto Role Deleted')
                    .setDescription(`${role} will no longer be automatically assigned to new members.`)
                    .setColor('#ED4245') // Red
                    .setTimestamp();

                // Apply branding
                applyBranding(embed);

                return interaction.reply({
                    embeds: [embed],
                    ephemeral: false // Make this visible to everyone
                });
            } catch (error) {
                console.error('Error deleting auto role:', error);
                return interaction.reply({
                    content: 'An error occurred while deleting the auto role.',
                    ephemeral: true
                });
            }
        }
        else if (subcommand === 'whitelist') {
            const time = options.getInteger('time');
            const channel = options.getChannel('channel');

            try {
                // Find or create whitelist roles in the server
                const whitelistRole = interaction.guild.roles.cache.find(r =>
                    r.name.toLowerCase() === 'whitelist' || r.name.toLowerCase() === 'whitelisted'
                );

                if (!whitelistRole) {
                    return interaction.reply({
                        content: '❌ No whitelist role found. Please create a role named "Whitelist" or "Whitelisted" first.',
                        ephemeral: true
                    });
                }

                // Create or update the whitelist config
                let config = await WhitelistConfig.findOne({ guildId });

                if (config) {
                    config.channelId = channel.id;
                    config.duration = time;
                    config.enabled = true;
                    await config.save();
                } else {
                    config = await WhitelistConfig.create({
                        guildId,
                        channelId: channel.id,
                        duration: time,
                        enabled: true,
                        addedBy: interaction.user.id
                    });
                }

                // Create success embed
                const embed = new EmbedBuilder()
                    .setTitle('✅ Whitelist Auto-Role Configured')
                    .setDescription(`Automatic whitelist role assignment has been enabled!`)
                    .setColor('#57F287') // Green
                    .addFields(
                        { name: 'Channel', value: channel.toString(), inline: true },
                        { name: 'Duration', value: `${time} hour${time === 1 ? '' : 's'}`, inline: true },
                        { name: 'Role', value: whitelistRole.toString(), inline: true }
                    )
                    .setFooter({ text: 'Users typing whitelist keywords will automatically receive the role' })
                    .setTimestamp();

                // Apply branding
                applyBranding(embed);

                return interaction.reply({
                    embeds: [embed]
                });
            } catch (error) {
                console.error('Error configuring whitelist auto-role:', error);
                return interaction.reply({
                    content: 'An error occurred while configuring the whitelist auto-role.',
                    ephemeral: true
                });
            }
        }
        else if (subcommand === 'whitelist-disable') {
            try {
                // Find the whitelist config
                const config = await WhitelistConfig.findOne({ guildId });

                if (!config) {
                    return interaction.reply({
                        content: 'No whitelist auto-role configuration found for this server.',
                        ephemeral: true
                    });
                }

                // Disable the config
                config.enabled = false;
                await config.save();

                // Create success embed
                const embed = new EmbedBuilder()
                    .setTitle('Whitelist Auto-Role Disabled')
                    .setDescription('Automatic whitelist role assignment has been disabled.')
                    .setColor('#ED4245') // Red
                    .setTimestamp();

                // Apply branding
                applyBranding(embed);

                return interaction.reply({
                    embeds: [embed],
                    ephemeral: true
                });
            } catch (error) {
                console.error('Error disabling whitelist auto-role:', error);
                return interaction.reply({
                    content: 'An error occurred while disabling the whitelist auto-role.',
                    ephemeral: true
                });
            }
        }
    }

    else if (commandName === 'branding') {
        const subcommand = options.getSubcommand();
        const guildId = interaction.guild.id;

        if (subcommand === 'name') {
            const nickname = options.getString('nickname');

            try {
                // Set the bot's nickname in the server
                await interaction.guild.members.me.setNickname(nickname);

                // Create a success embed
                let embed = new EmbedBuilder()
                    .setTitle('`✅`**Bot Nickname Updated**')
                    .setDescription(`The bot's nickname has been updated to "${nickname}" for this server.`)
                    .setColor('#57F287') // Green
                    .setTimestamp();

                // Apply branding
                embed = applyBranding(embed);

                return interaction.reply({
                    embeds: [embed],
                    ephemeral: true
                });
            } catch (error) {
                console.error('Error updating bot nickname:', error);
                return interaction.reply({
                    content: 'An error occurred while updating the bot\'s nickname. Make sure the bot has permission to change nicknames.',
                    ephemeral: true
                });
            }
        }

        else if (subcommand === 'colour') {
            const color = options.getString('colour');

            // Validate color format (basic hex validation)
            if (!/^#[0-9A-F]{6}$/i.test(color)) {
                return interaction.reply({
                    content: 'Invalid color format. Please use a valid hex color code (e.g., #FF0000 for red).',
                    ephemeral: true
                });
            }

            try {
                // Get existing config or create new one
                let config = await BrandingConfig.findOne({ guildId });

                if (!config) {
                    config = new BrandingConfig({
                        guildId,
                        status: {
                            type: 'PLAYING',
                            text: 'with Discord.js'
                        },
                        embedConfig: {
                            color: color,
                            footer: null
                        },
                        updatedBy: interaction.user.id,
                        updatedAt: new Date()
                    });
                } else {
                    // Update color field
                    config.embedConfig.color = color;
                    config.updatedBy = interaction.user.id;
                    config.updatedAt = new Date();
                }

                await config.save();

                // Update the global branding config
                global.brandingConfig = config;

                // Create a success embed with the new color
                let embed = new EmbedBuilder()
                    .setTitle('`✅`**Embed Color Updated**')
                    .setDescription(`All embeds will now use the color ${color}.`)
                    .setColor(color)
                    .setTimestamp();

                // Apply branding (just for footer in this case since color is explicitly set)
                embed = applyBranding(embed);

                // Add footer if configured
                if (config.embedConfig.footer) {
                    embed.setFooter({ text: config.embedConfig.footer });
                }

                return interaction.reply({
                    embeds: [embed],
                    ephemeral: true
                });
            } catch (error) {
                console.error('Error updating embed color:', error);
                return interaction.reply({
                    content: 'An error occurred while updating the embed color.',
                    ephemeral: true
                });
            }
        }

        else if (subcommand === 'footer') {
            // Create a modal for the footer input
            const modal = new ModalBuilder()
                .setCustomId('branding_footer_modal')
                .setTitle('Set Embed Footer');

            // Add footer text input
            const footerInput = new TextInputBuilder()
                .setCustomId('footer_text')
                .setLabel('Footer Text')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('Enter the footer text for all embeds')
                .setRequired(true)
                .setMaxLength(1024);

            // Add the text input to the modal
            const firstActionRow = new ActionRowBuilder().addComponents(footerInput);
            modal.addComponents(firstActionRow);

            // Show the modal to the user
            await interaction.showModal(modal);
            return;
        }

        else if (subcommand === 'banner') {
            const bannerUrl = options.getString('url');

            // Validate URL format
            try {
                new URL(bannerUrl);
            } catch (error) {
                return interaction.reply({
                    content: 'Invalid URL format. Please provide a valid image URL.',
                    ephemeral: true
                });
            }

            try {
                // Get existing config or create new one
                let config = await BrandingConfig.findOne({ guildId });

                if (!config) {
                    config = new BrandingConfig({
                        guildId,
                        status: {
                            type: 'PLAYING',
                            text: 'with Discord.js'
                        },
                        embedConfig: {
                            color: '#5865F2', // Default Discord blue
                            footer: null,
                            banner: bannerUrl
                        },
                        updatedBy: interaction.user.id,
                        updatedAt: new Date()
                    });
                } else {
                    // Update banner field
                    config.embedConfig.banner = bannerUrl;
                    config.updatedBy = interaction.user.id;
                    config.updatedAt = new Date();
                }

                await config.save();

                // Update the global branding config
                global.brandingConfig = config;

                // Create a success embed with the new banner
                let embed = new EmbedBuilder()
                    .setTitle('`✅`**Embed Banner Updated**')
                    .setDescription('The banner image for embeds has been updated successfully.')
                    .setColor(config.embedConfig.color || '#57F287')
                    .setImage(bannerUrl);

                // Apply branding (just for footer in this case)
                if (config.embedConfig.footer) {
                    embed.setFooter({ text: config.embedConfig.footer });
                } else {
                    embed.setTimestamp();
                }

                return interaction.reply({
                    embeds: [embed],
                    ephemeral: true
                });
            } catch (error) {
                console.error('Error updating embed banner:', error);
                return interaction.reply({
                    content: 'An error occurred while updating the embed banner.',
                    ephemeral: true
                });
            }
        }
    }

    else if (commandName === 'status_blacklist') {
        const subcommand = options.getSubcommand();
        const guildId = interaction.guild.id;

        if (subcommand === 'add') {
            const keyword = options.getString('keyword');
            const action = options.getString('action');
            const role = options.getRole('role');

            // Validate role if action is 'role'
            if (action === 'role' && !role) {
                return interaction.reply({
                    content: 'You must specify a role when the action is "Assign Role".',
                    ephemeral: true
                });
            }

            try {
                // Check if the keyword is already blacklisted
                const existingBlacklist = await StatusBlacklist.findOne({ guildId, keyword });
                if (existingBlacklist) {
                    return interaction.reply({
                        content: `The keyword "${keyword}" is already blacklisted with action: ${existingBlacklist.action}.`,
                        ephemeral: true
                    });
                }

                // Create the blacklist entry
                await StatusBlacklist.create({
                    guildId,
                    keyword,
                    action,
                    roleId: role?.id,
                    addedBy: interaction.user.id
                });

                // Create a success embed
                const embed = new EmbedBuilder()
                    .setTitle('`✅`**Status Blacklist Added**')
                    .setDescription(`The keyword "${keyword}" has been added to the status blacklist.`)
                    .addFields(
                        { name: '**Keyword**', value: keyword, inline: true },
                        { name: '**Action**', value: action.charAt(0).toUpperCase() + action.slice(1), inline: true },
                        { name: '**Added By**', value: interaction.user.toString(), inline: true }
                    )
                    .setColor('#FF0000') // Red
                    .setTimestamp();

                // Add role field if applicable
                if (action === 'role' && role) {
                    embed.addFields({ name: 'Role', value: role.toString(), inline: true });
                }

                return interaction.reply({
                    embeds: [embed],
                    ephemeral: false // Make this visible to everyone
                });
            } catch (error) {
                console.error('Error adding status blacklist:', error);
                return interaction.reply({
                    content: 'An error occurred while adding the status blacklist.',
                    ephemeral: true
                });
            }
        }
        else if (subcommand === 'del') {
            const keyword = options.getString('keyword');

            try {
                // Check if the keyword is blacklisted
                const blacklist = await StatusBlacklist.findOne({ guildId, keyword });
                if (!blacklist) {
                    return interaction.reply({
                        content: `The keyword "${keyword}" is not blacklisted.`,
                        ephemeral: true
                    });
                }

                // Delete the blacklist entry
                await StatusBlacklist.deleteOne({ guildId, keyword });

                // Create a success embed
                const embed = new EmbedBuilder()
                    .setTitle('`❌`**Status Blacklist Removed**')
                    .setDescription(`The keyword "${keyword}" has been removed from the status blacklist.`)
                    .addFields(
                        { name: '**Keyword**', value: keyword, inline: true },
                        { name: '**Previous Action**', value: blacklist.action.charAt(0).toUpperCase() + blacklist.action.slice(1), inline: true },
                        { name: '**Removed By**', value: interaction.user.toString(), inline: true }
                    )
                    .setColor('#00FF00') // Green
                    .setFooter({ text: 'Note: This will not unban users who were already banned for using this keyword.' })
                    .setTimestamp();

                return interaction.reply({
                    embeds: [embed],
                    ephemeral: false // Make this visible to everyone
                });
            } catch (error) {
                console.error('Error removing status blacklist:', error);
                return interaction.reply({
                    content: 'An error occurred while removing the status blacklist.',
                    ephemeral: true
                });
            }
        }
        else if (subcommand === 'list') {
            try {
                // Get all blacklisted keywords for this guild
                const blacklists = await StatusBlacklist.find({ guildId });

                if (blacklists.length === 0) {
                    return interaction.reply({
                        content: 'There are no blacklisted keywords for this server.',
                        ephemeral: true
                    });
                }

                // Create an embed to display the blacklisted keywords
                const embed = new EmbedBuilder()
                    .setTitle('`📃`**Status Blacklist**')
                    .setDescription(`This server has ${blacklists.length} blacklisted keywords.`)
                    .setColor('#5865F2') // Discord Blue
                    .setTimestamp();

                // Add each blacklisted keyword as a field
                for (const blacklist of blacklists) {
                    let actionText = blacklist.action.charAt(0).toUpperCase() + blacklist.action.slice(1);
                    if (blacklist.action === 'role' && blacklist.roleId) {
                        const role = await interaction.guild.roles.fetch(blacklist.roleId).catch(() => null);
                        if (role) {
                            actionText += ` (${role})`;
                        }
                    }

                    embed.addFields({
                        name: blacklist.keyword,
                        value: `Action: ${actionText}\nAdded: ${new Date(blacklist.addedAt).toLocaleString()}`
                    });
                }

                return interaction.reply({
                    embeds: [embed],
                    ephemeral: true
                });
            } catch (error) {
                console.error('Error listing status blacklists:', error);
                return interaction.reply({
                    content: 'An error occurred while listing the status blacklists.',
                    ephemeral: true
                });
            }
        }
    }

    else if (commandName === 'strike') {
        const subcommand = options.getSubcommand();
        const guildId = interaction.guild.id;
        const gangName = options.getString('gang_name');

        // Find the gang
        const gang = await Gang.findOne({ guildId, name: gangName });
        if (!gang) {
            return interaction.reply({
                content: `No gang found with the name "${gangName}".`,
                ephemeral: true
            });
        }

        if (subcommand === 'add') {
            const reason = options.getString('reason');

            try {
                // Add the strike to the gang
                gang.strikes.push({
                    reason,
                    issuedBy: interaction.user.id,
                    issuedAt: new Date()
                });

                await gang.save();

                // Create an embed to display the strike
                const embed = new EmbedBuilder()
                    .setTitle(`\`✅\`Strike Added to ${gangName}`)
                    .setDescription(`A strike has been added to the gang ${gangName}.`)
                    .addFields(
                        { name: '**Reason**', value: reason },
                        { name: '**Issued By**', value: interaction.user.toString() },
                        { name: '**Total Strikes**', value: gang.strikes.length.toString() }
                    )
                    .setColor('#FF0000') // Red
                    .setTimestamp();

                return interaction.reply({
                    embeds: [embed],
                    ephemeral: false // Make this visible to everyone
                });
            } catch (error) {
                console.error('Error adding strike to gang:', error);
                return interaction.reply({
                    content: 'An error occurred while adding the strike.',
                    ephemeral: true
                });
            }
        }
        else if (subcommand === 'remove') {
            const strikeIndex = options.getInteger('strike') - 1; // Convert to 0-based index

            // Check if the strike index is valid
            if (strikeIndex < 0 || strikeIndex >= gang.strikes.length) {
                return interaction.reply({
                    content: `Invalid strike index. The gang has ${gang.strikes.length} strikes (1-${gang.strikes.length}).`,
                    ephemeral: true
                });
            }

            try {
                // Get the strike details before removing
                const strike = gang.strikes[strikeIndex];
                const strikeReason = strike.reason;
                const strikeDate = new Date(strike.issuedAt).toLocaleString();

                // Remove the strike
                gang.strikes.splice(strikeIndex, 1);
                await gang.save();

                // Create an embed to display the removed strike
                const embed = new EmbedBuilder()
                    .setTitle(`\`❌\`Strike Removed from ${gangName}`)
                    .setDescription(`A strike has been removed from the gang ${gangName}.`)
                    .addFields(
                        { name: '**Removed Strike**', value: `Strike #${strikeIndex + 1}` },
                        { name: '**Reason**', value: strikeReason },
                        { name: '**Originally Issued On**', value: strikeDate },
                        { name: '**Removed By**', value: interaction.user.toString() },
                        { name: '**Remaining Strikes**', value: gang.strikes.length.toString() }
                    )
                    .setColor('#00FF00') // Green
                    .setTimestamp();

                return interaction.reply({
                    embeds: [embed],
                    ephemeral: false // Make this visible to everyone
                });
            } catch (error) {
                console.error('Error removing strike from gang:', error);
                return interaction.reply({
                    content: 'An error occurred while removing the strike.',
                    ephemeral: true
                });
            }
        }
        else if (subcommand === 'view') {
            try {
                // Create an embed to display the strikes
                const embed = new EmbedBuilder()
                    .setTitle(`\`📃\`Strikes for \`${gangName}\``)
                    .setDescription(`The gang \`${gangName}\` has \`${gang.strikes.length}\` strikes.`)
                    .setColor('#5865F2') // Discord Blue
                    .setTimestamp();

                // Add each strike as a field
                if (gang.strikes.length === 0) {
                    embed.addFields({ name: 'No Strikes', value: 'This gang has no strikes.' });
                } else {
                    for (let i = 0; i < gang.strikes.length; i++) {
                        const strike = gang.strikes[i];
                        const issuer = await interaction.guild.members.fetch(strike.issuedBy).catch(() => null);
                        const issuerName = issuer ? issuer.toString() : 'Unknown';
                        const strikeDate = new Date(strike.issuedAt).toLocaleString();

                        embed.addFields({
                            name: `Strike #${i + 1}`,
                            value: `**Reason:** ${strike.reason}\n**Issued By:** ${issuerName}\n**Issued On:** ${strikeDate}`
                        });
                    }
                }

                return interaction.reply({
                    embeds: [embed],
                    ephemeral: true
                });
            } catch (error) {
                console.error('Error viewing gang strikes:', error);
                return interaction.reply({
                    content: 'An error occurred while viewing the strikes.',
                    ephemeral: true
                });
            }
        }
    }

    else if (commandName === 'gangpriority') {
        const subcommand = options.getSubcommand();
        const guildId = interaction.guild.id;

        if (subcommand === 'setup') {
            const managerRole = options.getRole('manager_role');
            const logsChannel = options.getChannel('logs_channel');

            try {
                // Find or create gang priority config
                await GangPriority.findOneAndUpdate(
                    { guildId },
                    {
                        guildId,
                        managerRoleId: managerRole.id,
                        logsChannelId: logsChannel.id
                    },
                    { upsert: true, new: true }
                );

                // Send success message
                return interaction.reply({
                    content: `Gang Priority system has been set up successfully!\n` +
                        `Manager Role: ${managerRole}\n` +
                        `Logs Channel: ${logsChannel}`,
                    ephemeral: true
                });
            } catch (error) {
                console.error('Error setting up gang priority system:', error);
                return interaction.reply({
                    content: 'An error occurred while setting up the gang priority system.',
                    ephemeral: true
                });
            }
        }
    }

    else if (commandName === 'gang') {
        const subcommand = options.getSubcommand();
        const guildId = interaction.guild.id;

        // Check if gang priority system is set up
        const gangPriorityConfig = await GangPriority.findOne({ guildId });
        if (!gangPriorityConfig) {
            return interaction.reply({
                content: 'Gang Priority system is not set up. Please run `/gangpriority setup` first.',
                ephemeral: true
            });
        }

        // Check if user has permission to manage gangs
        const hasPermission = interaction.member.permissions.has(PermissionsBitField.Flags.Administrator) ||
            interaction.member.roles.cache.has(gangPriorityConfig.managerRoleId);

        if (!hasPermission) {
            return interaction.reply({
                content: 'You do not have permission to manage gangs.',
                ephemeral: true
            });
        }

        // Get logs channel
        const logsChannel = await interaction.guild.channels.fetch(gangPriorityConfig.logsChannelId).catch(() => null);

        if (subcommand === 'create') {
            const name = options.getString('name');
            const owner = options.getUser('owner');
            const tier = options.getRole('tier');
            const slots = options.getInteger('slots');

            // Check if gang already exists
            const existingGang = await Gang.findOne({ guildId, name });
            if (existingGang) {
                return interaction.reply({
                    content: `A gang with the name "${name}" already exists.`,
                    ephemeral: true
                });
            }

            // Check if user is already a gang owner
            const ownerGang = await Gang.findOne({ guildId, ownerId: owner.id });
            if (ownerGang) {
                return interaction.reply({
                    content: `${owner} is already the owner of the gang "${ownerGang.name}".`,
                    ephemeral: true
                });
            }

            try {
                // Create the gang
                const gang = await Gang.create({
                    guildId,
                    name,
                    ownerId: owner.id,
                    tierRoleId: tier.id,
                    slots,
                    members: []
                });

                // Log the action
                if (logsChannel) {
                    const embed = new EmbedBuilder()
                        .setTitle('`✅`Gang Created')
                        .setDescription(`**A new gang has been created.**`)
                        .addFields(
                            { name: '**Gang Name**', value: name, inline: true },
                            { name: '**Owner', value: `${owner}`, inline: true },
                            { name: '**Tier**', value: `${tier}`, inline: true },
                            { name: '**Slots**', value: `${slots}`, inline: true },
                            { name: '**Created By**', value: `${interaction.user}`, inline: true }
                        )
                        .setColor('#57F287') // Green
                        .setTimestamp();

                    await logsChannel.send({ embeds: [embed] });
                }

                // Try to DM the owner
                try {
                    const dmEmbed = new EmbedBuilder()
                        .setTitle('`👑` Congratulations on your purchase!')
                        .setDescription(`You are now the owner of the gang "\`${name}\`" in \`${interaction.guild.name}\`.`)
                        .addFields(
                            { name: '**Priority Tier**', value: `\`${tier}\``, inline: true },
                            { name: '**Available Slots**', value: `\`${slots}\``, inline: true },
                            { name: 'Commands', value:
                                '`/prio add @user` - Give priority to a user\n' +
                                '`/prio remove @user` - Remove priority from a user'
                            }
                        )
                        .setColor('#5865F2') // Discord Blue
                        .setFooter({ text: `Use these commands in ${interaction.guild.name}` });

                    await owner.send({ embeds: [dmEmbed] });
                } catch (error) {
                    console.log(`Could not DM user ${owner.tag}: ${error.message}`);
                }

                return interaction.reply({
                    content: `Gang "${name}" has been created successfully with ${owner} as the owner.`,
                    ephemeral: true
                });
            } catch (error) {
                console.error('Error creating gang:', error);
                return interaction.reply({
                    content: 'An error occurred while creating the gang.',
                    ephemeral: true
                });
            }
        }
        else if (subcommand === 'upgrade') {
            const name = options.getString('name');
            const tier = options.getRole('tier');
            const slots = options.getInteger('slots');

            // Check if at least one upgrade option is provided
            if (!tier && !slots) {
                return interaction.reply({
                    content: 'You must provide at least one upgrade option (tier or slots).',
                    ephemeral: true
                });
            }

            // Find the gang
            const gang = await Gang.findOne({ guildId, name });
            if (!gang) {
                return interaction.reply({
                    content: `No gang with the name "${name}" was found.`,
                    ephemeral: true
                });
            }

            // Check if slots is valid (must be greater than current slots)
            if (slots && slots <= gang.slots) {
                return interaction.reply({
                    content: `The new slot count must be greater than the current slot count (${gang.slots}).`,
                    ephemeral: true
                });
            }

            try {
                // Update the gang
                const updates = {};
                if (tier) updates.tierRoleId = tier.id;
                if (slots) updates.slots = slots;

                const updatedGang = await Gang.findOneAndUpdate(
                    { guildId, name },
                    { $set: updates },
                    { new: true }
                );

                // If tier was updated, update all members' roles
                if (tier && gang.tierRoleId !== tier.id) {
                    const oldTier = await interaction.guild.roles.fetch(gang.tierRoleId).catch(() => null);

                    // Update roles for all members
                    for (const memberData of gang.members) {
                        const member = await interaction.guild.members.fetch(memberData.userId).catch(() => null);
                        if (member) {
                            // Remove old role if it exists
                            if (oldTier) await member.roles.remove(oldTier);

                            // Add new role
                            await member.roles.add(tier);
                        }
                    }
                }

                // Log the action
                if (logsChannel) {
                    const embed = new EmbedBuilder()
                        .setTitle('`✅`Gang Upgraded')
                        .setDescription(`Gang "\`${name}\`" has been upgraded.`)
                        .setColor('#5865F2') // Discord Blue
                        .setTimestamp();

                    if (tier) {
                        embed.addFields({ name: 'New Tier', value: `${tier}`, inline: true });
                    }

                    if (slots) {
                        embed.addFields({ name: 'New Slots', value: `${slots}`, inline: true });
                    }

                    embed.addFields({ name: 'Upgraded By', value: `${interaction.user}`, inline: true });

                    await logsChannel.send({ embeds: [embed] });
                }

                return interaction.reply({
                    content: `Gang "${name}" has been upgraded successfully.`,
                    ephemeral: true
                });
            } catch (error) {
                console.error('Error upgrading gang:', error);
                return interaction.reply({
                    content: 'An error occurred while upgrading the gang.',
                    ephemeral: true
                });
            }
        }
        else if (subcommand === 'lookup') {
            const gangName = options.getString('gang_name');

            // Find the gang
            const gang = await Gang.findOne({ guildId, name: gangName });
            if (!gang) {
                return interaction.reply({
                    content: `No gang with the name "${gangName}" was found.`,
                    ephemeral: true
                });
            }

            try {
                // Get owner and tier information
                const owner = await interaction.guild.members.fetch(gang.ownerId).catch(() => null);
                const tier = await interaction.guild.roles.fetch(gang.tierRoleId).catch(() => null);

                // Create member list
                let memberList = '';
                for (const memberData of gang.members) {
                    const member = await interaction.guild.members.fetch(memberData.userId).catch(() => null);
                    if (member) {
                        const addedDate = new Date(memberData.addedAt).toLocaleDateString();
                        memberList += `${member} - Added: ${addedDate}\n`;
                    }
                }

                if (!memberList) memberList = 'No members';

                // Create embed
                const embed = new EmbedBuilder()
                    .setTitle(`Gang: \`${gang.name}\``)
                    .addFields(
                        { name: '**Owner**', value: owner ? `${owner}` : 'Unknown', inline: true },
                        { name: '**Tier**', value: tier ? `${tier}` : 'Unknown', inline: true },
                        { name: '**Slots**', value: `${gang.members.length}/${gang.slots}`, inline: true },
                        { name: '**Members**', value: memberList }
                    )
                    .setColor('#5865F2') // Discord Blue
                    .setTimestamp();

                return interaction.reply({
                    embeds: [embed],
                    ephemeral: true
                });
            } catch (error) {
                console.error('Error looking up gang:', error);
                return interaction.reply({
                    content: 'An error occurred while looking up the gang.',
                    ephemeral: true
                });
            }
        }
        else if (subcommand === 'list') {
            try {
                // Get all gangs for this guild
                const gangs = await Gang.find({ guildId });

                if (gangs.length === 0) {
                    return interaction.reply({
                        content: 'No gangs have been created for this server.',
                        ephemeral: true
                    });
                }

                // Create embed
                const embed = new EmbedBuilder()
                    .setTitle('`📃`**Gang List**')
                    .setDescription(`This server has \`${gangs.length}\` gangs.`)
                    .setColor('#5865F2') // Discord Blue
                    .setTimestamp();

                // Add each gang as a field
                for (const gang of gangs) {
                    const owner = await interaction.guild.members.fetch(gang.ownerId).catch(() => null);
                    const ownerName = owner ? owner.displayName : 'Unknown';

                    embed.addFields({
                        name: gang.name,
                        value: `Owner: ${ownerName}\nMembers: ${gang.members.length}/${gang.slots}`,
                        inline: true
                    });
                }

                return interaction.reply({
                    embeds: [embed],
                    ephemeral: true
                });
            } catch (error) {
                console.error('Error listing gangs:', error);
                return interaction.reply({
                    content: 'An error occurred while listing gangs.',
                    ephemeral: true
                });
            }
        }
        else if (subcommand === 'delete') {
            const name = options.getString('name');

            // Find the gang
            const gang = await Gang.findOne({ guildId, name });
            if (!gang) {
                return interaction.reply({
                    content: `No gang with the name "${name}" was found.`,
                    ephemeral: true
                });
            }

            try {
                // Get tier information
                const tier = await interaction.guild.roles.fetch(gang.tierRoleId).catch(() => null);

                // Remove roles from all members
                if (tier) {
                    for (const memberData of gang.members) {
                        try {
                            const member = await interaction.guild.members.fetch(memberData.userId).catch(() => null);
                            if (member) {
                                await member.roles.remove(tier).catch(error => {
                                    // Log the error but continue with other members
                                    if (error.code === 50013) {
                                        console.warn('Missing permissions to remove roles. Please check the bot\'s role hierarchy.');
                                    } else {
                                        console.error('Error removing role from gang member:', error.message);
                                    }
                                });
                            }
                        } catch (memberError) {
                            console.error('Error processing gang member:', memberError.message);
                            // Continue with other members
                        }
                    }
                }

                // Delete the gang
                await Gang.deleteOne({ guildId, name });

                // Log the action
                if (logsChannel) {
                    const embed = new EmbedBuilder()
                        .setTitle('`❌`Gang Deleted')
                        .setDescription(`Gang "\`${name}\`" has been deleted.`)
                        .addFields(
                            { name: '**Deleted By**', value: `${interaction.user}`, inline: true }
                        )
                        .setColor('#ED4245') // Red
                        .setTimestamp();

                    await logsChannel.send({ embeds: [embed] });
                }

                return interaction.reply({
                    content: `Gang "${name}" has been deleted successfully.`,
                    ephemeral: true
                });
            } catch (error) {
                console.error('Error deleting gang:', error);
                return interaction.reply({
                    content: 'An error occurred while deleting the gang.',
                    ephemeral: true
                });
            }
        }
    }

    else if (commandName === 'prio') {
        const subcommand = options.getSubcommand();
        const guildId = interaction.guild.id;
        const user = options.getUser('user');

        // Check if gang priority system is set up
        const gangPriorityConfig = await GangPriority.findOne({ guildId });
        if (!gangPriorityConfig) {
            return interaction.reply({
                content: 'Gang Priority system is not set up. Please ask an administrator to run `/gangpriority setup` first.',
                ephemeral: true
            });
        }

        // Find gang owned by the user
        const gang = await Gang.findOne({ guildId, ownerId: interaction.user.id });
        if (!gang) {
            return interaction.reply({
                content: 'You do not own a gang. Only gang owners can manage priority.',
                ephemeral: true
            });
        }

        // Get logs channel
        const logsChannel = await interaction.guild.channels.fetch(gangPriorityConfig.logsChannelId).catch(() => null);

        if (subcommand === 'add') {
            // Check if user is already in the gang
            const isMember = gang.members.some(member => member.userId === user.id);
            if (isMember) {
                return interaction.reply({
                    content: `${user} already has priority from your gang.`,
                    ephemeral: true
                });
            }

            // Check if gang has available slots
            if (gang.members.length >= gang.slots) {
                return interaction.reply({
                    content: `Your gang has reached its maximum capacity of ${gang.slots} members.`,
                    ephemeral: true
                });
            }

            try {
                // Get the member and tier role
                const member = await interaction.guild.members.fetch(user.id).catch(() => null);
                const tier = await interaction.guild.roles.fetch(gang.tierRoleId).catch(() => null);

                if (!member) {
                    return interaction.reply({
                        content: 'User not found in this server.',
                        ephemeral: true
                    });
                }

                if (!tier) {
                    return interaction.reply({
                        content: 'Priority role not found. Please contact an administrator.',
                        ephemeral: true
                    });
                }

                // Add the user to the gang
                await Gang.updateOne(
                    { guildId, _id: gang._id },
                    { $push: { members: { userId: user.id, addedAt: new Date() } } }
                );

                // Add the role to the user
                try {
                    await member.roles.add(tier);
                } catch (error) {
                    // Log the error but continue with the process
                    if (error.code === 50013) {
                        console.warn('Missing permissions to add roles. Please check the bot\'s role hierarchy.');
                        return interaction.reply({
                            content: 'Failed to add the role due to missing permissions. The user has been added to the gang database, but you\'ll need to manually assign the role.',
                            ephemeral: true
                        });
                    } else {
                        console.error('Error adding role to member:', error.message);
                        return interaction.reply({
                            content: 'An error occurred while adding the role. The user has been added to the gang database, but you\'ll need to manually assign the role.',
                            ephemeral: true
                        });
                    }
                }

                // Log the action
                if (logsChannel) {
                    const embed = new EmbedBuilder()
                        .setTitle('`✅`**Priority Added**')
                        .setDescription(`${user} has been given priority by ${interaction.user}.`)
                        .addFields(
                            { name: '**Gang**', value: gang.name, inline: true },
                            { name: '**Tier**', value: `\`${tier}\``, inline: true }
                        )
                        .setColor('#57F287') // Green
                        .setTimestamp();

                    await logsChannel.send({ embeds: [embed] });
                }

                return interaction.reply({
                    content: `Successfully added ${user} to your gang with ${tier} priority.`,
                    ephemeral: true
                });
            } catch (error) {
                console.error('Error adding priority:', error);
                return interaction.reply({
                    content: 'An error occurred while adding priority.',
                    ephemeral: true
                });
            }
        }
        else if (subcommand === 'remove') {
            // Check if user is in the gang
            const memberIndex = gang.members.findIndex(member => member.userId === user.id);
            if (memberIndex === -1) {
                return interaction.reply({
                    content: `${user} does not have priority from your gang.`,
                    ephemeral: true
                });
            }

            try {
                // Get the member and tier role
                const member = await interaction.guild.members.fetch(user.id).catch(() => null);
                const tier = await interaction.guild.roles.fetch(gang.tierRoleId).catch(() => null);

                // Remove the user from the gang
                await Gang.updateOne(
                    { guildId, _id: gang._id },
                    { $pull: { members: { userId: user.id } } }
                );

                // Remove the role from the user if they exist and the role exists
                if (member && tier) {
                    try {
                        await member.roles.remove(tier);
                    } catch (error) {
                        // Log the error but continue with the process
                        if (error.code === 50013) {
                            console.warn('Missing permissions to remove roles. Please check the bot\'s role hierarchy.');
                        } else {
                            console.error('Error removing role from member:', error.message);
                        }
                    }
                }

                // Log the action
                if (logsChannel) {
                    const embed = new EmbedBuilder()
                        .setTitle('`❌`Priority Removed')
                        .setDescription(`${user} has had priority removed by ${interaction.user}.`)
                        .addFields(
                            { name: '**Gang**', value: gang.name, inline: true },
                            { name: '**Tier**', value: tier ? `\`${tier}\`` : 'Unknown', inline: true }
                        )
                        .setColor('#ED4245') // Red
                        .setTimestamp();

                    await logsChannel.send({ embeds: [embed] });
                }

                return interaction.reply({
                    content: `Successfully removed ${user} from your gang.`,
                    ephemeral: true
                });
            } catch (error) {
                console.error('Error removing priority:', error);
                return interaction.reply({
                    content: 'An error occurred while removing priority.',
                    ephemeral: true
                });
            }
        }
    }

    else if (commandName === 'booster') {
        const guildId = interaction.guild.id;

        try {
            // Check if a configuration already exists for this guild
            let config = await BoosterConfig.findOne({ guildId });

            if (config) {
                // Update existing configuration to use the fixed message
                config.message = 'Thanks for boosting the server, Enjoy your booster perks';
                config.enabled = true;
                await config.save();
            } else {
                // Create new configuration with the fixed message
                config = await BoosterConfig.create({
                    guildId,
                    message: 'Thanks for boosting the server, Enjoy your booster perks',
                    enabled: true
                });
            }

            // Update the in-memory configuration
            boosterConfig.set(guildId, {
                message: config.message,
                enabled: config.enabled
            });

            // Create a success embed
            const embed = new EmbedBuilder()
                .setTitle('Booster Responder Configured')
                .setDescription('The booster auto-responder has been configured successfully!')
                .addFields({
                    name: 'Booster Message',
                    value: 'When someone boosts the server, they will be mentioned and receive the message:\n"Thanks for boosting the server, Enjoy your booster perks"'
                })
                .setColor('#FF73FA') // Discord Nitro pink color
                .setTimestamp();

            // Don't apply branding image, but set a custom footer with boost count
            const boostCount = interaction.guild.premiumSubscriptionCount;
            embed.setFooter({ text: `We now have ${boostCount} Boosts!` });

            return interaction.reply({
                embeds: [embed],
                ephemeral: true
            });
        } catch (error) {
            console.error('Error configuring booster responder:', error);
            return interaction.reply({
                content: 'An error occurred while configuring the booster responder.',
                ephemeral: true
            });
        }
    }

    else if (commandName === 'mass-unban') {

        // Create initial response embed
        const embed = new EmbedBuilder()
            .setTitle('`🔃`**Mass Unban in Progress**')
            .setDescription('Fetching banned users... Please wait.')
            .setColor('#FFA500') // Orange color for in-progress
            .setTimestamp();

        // Send initial response
        await interaction.reply({
            embeds: [embed],
            fetchReply: true
        });

        try {
            // Fetch all bans
            const bans = await interaction.guild.bans.fetch();

            if (bans.size === 0) {
                // No bans found
                embed.setTitle('`✅`**Mass Unban Complete**')
                    .setDescription('There are no banned users in this server.')
                    .setColor('#57F287'); // Green color for success

                await interaction.editReply({ embeds: [embed] });
                return;
            }

            // Update embed with ban count
            embed.setDescription(`Found \`${bans.size}\` banned users. Starting unban process...`);
            await interaction.editReply({ embeds: [embed] });

            // Track progress
            let unbannedCount = 0;
            let failedCount = 0;

            // Process bans in batches to avoid rate limits
            const batchSize = 5;
            const banArray = Array.from(bans.values());

            for (let i = 0; i < banArray.length; i += batchSize) {
                const batch = banArray.slice(i, i + batchSize);

                // Process each ban in the batch
                await Promise.all(batch.map(async (ban) => {
                    try {
                        await interaction.guild.members.unban(ban.user.id, 'Mass unban command');
                        unbannedCount++;
                    } catch (error) {
                        console.error(`Failed to unban ${ban.user.tag}:`, error);
                        failedCount++;
                    }
                }));

                // Update progress every batch
                if ((i + batch.length) % 10 === 0 || i + batch.length >= banArray.length) {
                    const progress = Math.floor(((unbannedCount + failedCount) / banArray.length) * 100);
                    embed.setDescription(`Unbanning users: ${progress}% complete\n` +
                        `\`✅\` **Successfully unbanned:** ${unbannedCount}\n` +
                        `\`❌\` Failed to unban: ${failedCount}\n` +
                        `Total banned users: ${banArray.length}`);
                    await interaction.editReply({ embeds: [embed] });
                }

                // Add a small delay between batches to avoid rate limits
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            // Final update
            embed.setTitle('`✅`**Mass Unban Complete**')
                .setDescription(`All unbans have been processed.\n\n` +
                    `\`✅\` Successfully unbanned: ${unbannedCount}\n` +
                    `\`❌\` Failed to unban: ${failedCount}\n` +
                    `Total banned users: ${banArray.length}`)
                .setColor(failedCount === 0 ? '#57F287' : '#FEE75C') // Green if all successful, yellow if some failed
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Error during mass unban:', error);

            // Update embed with error
            embed.setTitle('Mass Unban Failed')
                .setDescription(`An error occurred during the mass unban process: ${error.message}`)
                .setColor('#ED4245') // Red color for error
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        }
    }

    else if (commandName === 'welcome') {
        const subcommand = options.getSubcommand();
        const guildId = interaction.guild.id;

        if (subcommand === 'setup') {
            const channel = options.getChannel('channel');

            // Check if welcome config already exists
            let welcomeConfig = await Welcome.findOne({ guildId });

            if (welcomeConfig) {
                // Update existing config
                welcomeConfig.channelId = channel.id;
            } else {
                // Create new config with defaults
                welcomeConfig = new Welcome({
                    guildId,
                    channelId: channel.id,
                    imageGeneration: true,
                    imageConfig: {
                        background: 'server',
                        textColor: '#FFFFFF',
                        overlayColor: 'rgba(0, 0, 0, 0.6)',
                        borderColor: 'transparent'
                    }
                });
            }

            // Create a modal for customizing the welcome message
            const modal = new ModalBuilder()
                .setCustomId('welcome_setup')
                .setTitle('Welcome System Setup');

            // Message input
            const messageInput = new TextInputBuilder()
                .setCustomId('welcome_message')
                .setLabel('Welcome Message')
                .setStyle(TextInputStyle.Paragraph)
                .setValue(welcomeConfig.message)
                .setPlaceholder('Enter the welcome message')
                .setRequired(true);

            // Embed title input
            const titleInput = new TextInputBuilder()
                .setCustomId('welcome_title')
                .setLabel('Embed Title')
                .setStyle(TextInputStyle.Short)
                .setValue(welcomeConfig.embedConfig.title)
                .setPlaceholder('Enter the embed title')
                .setRequired(false);

            // Embed description input
            const descriptionInput = new TextInputBuilder()
                .setCustomId('welcome_description')
                .setLabel('Embed Description')
                .setStyle(TextInputStyle.Paragraph)
                .setValue(welcomeConfig.embedConfig.description)
                .setPlaceholder('Enter the embed description')
                .setRequired(false);

            // Embed color input
            const colorInput = new TextInputBuilder()
                .setCustomId('welcome_color')
                .setLabel('Embed Color (hex code, e.g. #5865F2)')
                .setStyle(TextInputStyle.Short)
                .setValue(welcomeConfig.embedConfig.color)
                .setPlaceholder('#5865F2')
                .setRequired(false);

            // Add inputs to modal
            modal.addComponents(
                new ActionRowBuilder().addComponents(messageInput),
                new ActionRowBuilder().addComponents(titleInput),
                new ActionRowBuilder().addComponents(descriptionInput),
                new ActionRowBuilder().addComponents(colorInput)
            );

            // Save the channel ID temporarily
            client.welcomeSetupChannel = channel.id;

            await interaction.showModal(modal);
            return;
        }
    }

    else if (commandName === 'keyword') {
        const subcommand = options.getSubcommand();
        const guildId = interaction.guild.id;

        if (subcommand === 'create') {
            const name = options.getString('name').toLowerCase();

            // Check if the keyword already exists
            const existingKeyword = await Keyword.findOne({ guildId, name });
            if (existingKeyword) {
                return interaction.reply({
                    content: `A keyword with the name "${name}" already exists.`,
                    ephemeral: true
                });
            }

            // Create a modal for the keyword creation
            const modal = new ModalBuilder()
                .setCustomId(`keyword_create_${name}`)
                .setTitle('Create Keyword Response');

            // Description input
            const descriptionInput = new TextInputBuilder()
                .setCustomId('keyword_description')
                .setLabel('Response Content')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true)
                .setPlaceholder('Enter the content for your keyword response');

            // Color input
            const colorInput = new TextInputBuilder()
                .setCustomId('keyword_color')
                .setLabel('Embed Color (hex code, e.g. #5865F2)')
                .setStyle(TextInputStyle.Short)
                .setRequired(false)
                .setPlaceholder('#5865F2');

            // Footer input
            const footerInput = new TextInputBuilder()
                .setCustomId('keyword_footer')
                .setLabel('Embed Footer Text')
                .setStyle(TextInputStyle.Short)
                .setRequired(false)
                .setPlaceholder('Enter footer text for your embed');

            // Image URL input
            const imageInput = new TextInputBuilder()
                .setCustomId('keyword_image')
                .setLabel('Image URL (optional)')
                .setStyle(TextInputStyle.Short)
                .setRequired(false)
                .setPlaceholder('Enter a URL for an image to display');

            // Add inputs to modal
            modal.addComponents(
                new ActionRowBuilder().addComponents(descriptionInput),
                new ActionRowBuilder().addComponents(colorInput),
                new ActionRowBuilder().addComponents(footerInput),
                new ActionRowBuilder().addComponents(imageInput)
            );

            await interaction.showModal(modal);
            return;
        }
        else if (subcommand === 'delete') {
            const name = options.getString('name').toLowerCase();

            // Check if the keyword exists
            const keyword = await Keyword.findOne({ guildId, name });
            if (!keyword) {
                return interaction.reply({
                    content: `No keyword with the name "${name}" was found.`,
                    ephemeral: true
                });
            }

            // Delete the keyword
            await Keyword.deleteOne({ guildId, name });

            return interaction.reply({
                content: `Keyword "${name}" has been deleted.`,
                ephemeral: true
            });
        }
        else if (subcommand === 'list') {
            // Get all keywords for this guild
            const keywords = await Keyword.find({ guildId });

            if (keywords.length === 0) {
                return interaction.reply({
                    content: 'No keywords have been created for this server.',
                    ephemeral: true
                });
            }

            // Create an embed to display the keywords
            const embed = new EmbedBuilder()
                .setTitle('Keyword Responses')
                .setDescription(`This server has ${keywords.length} keyword responses.`)
                .setColor('#5865F2')
                .setTimestamp();

            // Add each keyword as a field
            keywords.forEach(keyword => {
                embed.addFields({
                    name: keyword.name,
                    value: keyword.description.length > 100
                        ? keyword.description.substring(0, 97) + '...'
                        : keyword.description
                });
            });

            return interaction.reply({
                embeds: [embed],
                ephemeral: true
            });
        }
    }

    else if (commandName === 'embed') {
        const subcommand = options.getSubcommand();
        const guildId = interaction.guild.id;

        if (subcommand === 'template') {
            const templateType = options.getString('type');
            const channel = options.getChannel('channel');

            // Define templates
            const templates = {
                starter_tips: {
                    title: 'Starter Tips for Roleplay',
                    description: '# :bangbang: **_Important Concepts_**:bangbang: \n**In Character (IC) & Out Of Character (OOC) **:speaking_head: \nAn especially important concept of roleplay is staying In Character (IC). This means putting yourself in your character\'s shoes. You are only aware of what your character is aware of, you feel your character\'s pain, emotions, thoughts, and much more. While RPing, you will always want to remain in character, unless you are explicitly talking Out Of Character (OOC).\n\nTalking OOC while in-game is not allowed. This is called breaking RP and interrupts the ongoing conversation. This also ruins the RP for anyone else and is also a punishable event in our server.:x: \n\n# **Doing Actions In-Character**:point_up: \nMost FiveM servers also have a command to "do an action" as your character.\n\nFor example, if you want to pick up a penny on the sidewalk, you would run the following command:\n**/me picks up a penny**\n\nThese actions are always in the first person. It can be used to describe items you have, emotions you are feeling, and other things you may need to communicate while in character non-verbally.\n\n*However, there are limits to these actions. Your actions are limited to your character, you cannot tell others what to do, or what will happen — This is called power-gaming. This doesn\'t allow the other player to respond or contribute to the roleplay.*\n\n# :page_with_curl: **Naming Your Character**:page_with_curl: \n**Your character will need a name, and the possibilities are endless! You can make it as realistic or funny as you want, but there are typically a few common rules that servers enforce:**\n- You can\'t use the names of celebrities\n- Avoid the names of religious figures\n- It must be somewhat unique\n- It must be... a name\n\n*As long as you follow these guidelines (and common sense), all you have to do is come up with a creative name for the personality you want to create.*\n\n**AFTER YOU NAME YOURSELF AND GIVE YOURSELF A BIRTHDAY, YOU WILL CREATE YOUR CHARACTER!**\n\n# :tada: **That\'s It!**:tada: \n***Those are the basics of GTA roleplay. Luckily you found our server to play in, so get started! And most important of all, don\'t forget to have fun and enjoy yourself!***',
                    color: '#5865F2'
                },
                donations: {
                    title: '💸 Donations',
                    description: 'https://storepage.com\n**Once you purchase an item from the store, please create a donation ticket to receive your item!**',
                    color: '#00FF00'
                },
                greenzone: {
                    title: '🟢 Greenzone Locations',
                    description: '- Apartments / house interiors\n- Car Dealership\n- Hospitals\n- Gun Stores\n- Car Garages\n- Clothing Stores\n- Community Service\n- Job Centres',
                    color: '#00FF00'
                },
                changelogs: {
                    title: '🚧 Change Logs',
                    description: '- \n- \n-',
                    color: '#FFA500'
                }
            };

            // Get the selected template
            const template = templates[templateType];

            if (!template) {
                return interaction.reply({
                    content: 'Template not found. Please try again.',
                    ephemeral: true
                });
            }

            // Set template content
            const templateTitle = template.title;
            const templateDescription = template.description;
            const templateColor = template.color;

            try {
                // Create a modal for editing the template
                const modal = new ModalBuilder()
                    .setCustomId(`template_edit_${channel.id}`)
                    .setTitle('Edit Starter Tips Template');

                // Title input
                const titleInput = new TextInputBuilder()
                    .setCustomId('template_title')
                    .setLabel('Title')
                    .setStyle(TextInputStyle.Short)
                    .setValue(templateTitle)
                    .setRequired(true);

                // Description input - we'll need to truncate this as modals have a limit
                // Discord modals have a 4000 character limit per text input
                const descriptionInput = new TextInputBuilder()
                    .setCustomId('template_description')
                    .setLabel('Description (supports markdown)')
                    .setStyle(TextInputStyle.Paragraph)
                    .setValue(templateDescription.substring(0, 3900)) // Truncate to be safe
                    .setRequired(true);

                // Color input
                const colorInput = new TextInputBuilder()
                    .setCustomId('template_color')
                    .setLabel('Color (hex code, e.g. #5865F2)')
                    .setStyle(TextInputStyle.Short)
                    .setValue(templateColor)
                    .setRequired(true);

                // Add inputs to the modal
                modal.addComponents(
                    new ActionRowBuilder().addComponents(titleInput),
                    new ActionRowBuilder().addComponents(descriptionInput),
                    new ActionRowBuilder().addComponents(colorInput)
                );

                // Show the modal
                await interaction.showModal(modal);

            } catch (error) {
                console.error('Error showing template edit modal:', error);
                return interaction.reply({
                    content: 'An error occurred while preparing the template editor.',
                    ephemeral: true
                });
            }
        }
        else if (subcommand === 'generate') {
            const channel = options.getChannel('channel');

            // Create a modal for the embed creation
            const modal = new ModalBuilder()
                .setCustomId(`embed_create_${channel.id}`)
                .setTitle('Create Embed');

            // Title input
            const titleInput = new TextInputBuilder()
                .setCustomId('embed_title')
                .setLabel('Embed Title')
                .setStyle(TextInputStyle.Short)
                .setRequired(false)
                .setPlaceholder('Enter a title for your embed');

            // Description input
            const descriptionInput = new TextInputBuilder()
                .setCustomId('embed_description')
                .setLabel('Embed Description')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(false)
                .setPlaceholder('Enter a description for your embed');

            // Color input
            const colorInput = new TextInputBuilder()
                .setCustomId('embed_color')
                .setLabel('Embed Color (hex code, e.g. #5865F2)')
                .setStyle(TextInputStyle.Short)
                .setRequired(false)
                .setPlaceholder('#5865F2');

            // Footer input
            const footerInput = new TextInputBuilder()
                .setCustomId('embed_footer')
                .setLabel('Embed Footer Text')
                .setStyle(TextInputStyle.Short)
                .setRequired(false)
                .setPlaceholder('Enter footer text for your embed');

            // Image URL input
            const imageInput = new TextInputBuilder()
                .setCustomId('embed_image')
                .setLabel('Image URL (optional)')
                .setStyle(TextInputStyle.Short)
                .setRequired(false)
                .setPlaceholder('Enter a URL for an image to display');

            // Add inputs to modal
            modal.addComponents(
                new ActionRowBuilder().addComponents(titleInput),
                new ActionRowBuilder().addComponents(descriptionInput),
                new ActionRowBuilder().addComponents(colorInput),
                new ActionRowBuilder().addComponents(footerInput),
                new ActionRowBuilder().addComponents(imageInput)
            );

            await interaction.showModal(modal);
            return;
        }
        else if (subcommand === 'edit') {
            const messageId = options.getString('message_id');
            const channel = options.getChannel('channel');

            try {
                // Fetch the message to edit
                const message = await channel.messages.fetch(messageId);

                if (!message) {
                    return interaction.reply({
                        content: 'Message not found. Please check the message ID and channel.',
                        ephemeral: true
                    });
                }

                if (!message.embeds || message.embeds.length === 0) {
                    return interaction.reply({
                        content: 'The specified message does not contain an embed.',
                        ephemeral: true
                    });
                }

                // Get the existing embed
                const existingEmbed = message.embeds[0];

                // Create a modal for editing the embed
                const modal = new ModalBuilder()
                    .setCustomId(`embed_edit_${channel.id}_${messageId}`)
                    .setTitle('Edit Embed');

                // Title input
                const titleInput = new TextInputBuilder()
                    .setCustomId('embed_title')
                    .setLabel('Embed Title')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(false)
                    .setValue(existingEmbed.title || '')
                    .setPlaceholder('Enter a title for your embed');

                // Description input
                const descriptionInput = new TextInputBuilder()
                    .setCustomId('embed_description')
                    .setLabel('Embed Description')
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(false)
                    .setValue(existingEmbed.description || '')
                    .setPlaceholder('Enter a description for your embed');

                // Color input
                const colorInput = new TextInputBuilder()
                    .setCustomId('embed_color')
                    .setLabel('Embed Color (hex code, e.g. #5865F2)')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(false)
                    .setValue(existingEmbed.hexColor || '#5865F2')
                    .setPlaceholder('#5865F2');

                // Footer input
                const footerInput = new TextInputBuilder()
                    .setCustomId('embed_footer')
                    .setLabel('Embed Footer Text')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(false)
                    .setValue(existingEmbed.footer?.text || '')
                    .setPlaceholder('Enter footer text for your embed');

                // Image URL input
                const imageInput = new TextInputBuilder()
                    .setCustomId('embed_image')
                    .setLabel('Image URL (optional)')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(false)
                    .setValue(existingEmbed.image?.url || '')
                    .setPlaceholder('Enter a URL for an image to display');

                // Add inputs to modal
                modal.addComponents(
                    new ActionRowBuilder().addComponents(titleInput),
                    new ActionRowBuilder().addComponents(descriptionInput),
                    new ActionRowBuilder().addComponents(colorInput),
                    new ActionRowBuilder().addComponents(footerInput),
                    new ActionRowBuilder().addComponents(imageInput)
                );

                await interaction.showModal(modal);
                return;
            } catch (error) {
                console.error('Error fetching message for embed editing:', error);
                return interaction.reply({
                    content: 'An error occurred while trying to fetch the message. Please check the message ID and channel.',
                    ephemeral: true
                });
            }
        }
    }

    else if (commandName === 'vanityroles') {
        const subcommand = options.getSubcommand();
        const guildId = interaction.guild.id;

        // Initialize config if it doesn't exist
        if (!vanityRolesConfig.has(guildId)) {
            vanityRolesConfig.set(guildId, {
                roleId: null,
                vanityUrl: null,
                channelId: null,
                notificationType: 'channel',
                embedConfig: {
                    description: '{member} has added the vanity ({vanityURL}) to their status, their role has been added.',
                    color: '#5865F2'
                }
            });
        }

        const config = vanityRolesConfig.get(guildId);

        if (subcommand === 'setup') {
            const role = options.getRole('role');
            const url = options.getString('url');
            const channel = options.getChannel('channel');
            const notificationType = options.getString('notification_type') || 'channel';

            // Normalize the URL (remove discord.gg/ prefix if present)
            const normalizedUrl = url.replace(/^(https?:\/\/)?(discord\.gg\/|discord\.com\/invite\/)?/i, '');

            // Create the configuration object
            const configData = {
                roleId: role.id,
                vanityUrl: normalizedUrl,
                channelId: channel.id,
                notificationType: notificationType,
                embedConfig: {
                    description: '{member} has added the vanity ({vanityURL}) to their status, their role has been added.',
                    color: '#5865F2'
                }
            };

            // Store in memory
            vanityRolesConfig.set(guildId, configData);

            // Save to database
            try {
                await VanityRolesConfig.findOneAndUpdate(
                    { guildId },
                    {
                        guildId,
                        ...configData
                    },
                    { upsert: true, new: true }
                );

                return interaction.reply({
                    content: `Vanity Roles system has been set up successfully!`,
                    ephemeral: true
                });
            } catch (error) {
                console.error('Error saving vanity roles configuration:', error);
                return interaction.reply({
                    content: `An error occurred while setting up the Vanity Roles system. Please try again.`,
                    ephemeral: true
                });
            }
        }
        else if (subcommand === 'embed') {
            // Check if vanity roles are set up
            if (!config.vanityUrl || !config.roleId) {
                return interaction.reply({
                    content: 'You need to set up the Vanity Roles Module first. Use `/vanityroles setup` to configure it.',
                    ephemeral: true
                });
            }

            // Create a modal for customizing the embed
            const modal = new ModalBuilder()
                .setCustomId('vanityroles_embed_config')
                .setTitle('Customize Vanity Notification Embed');

            // Description input
            const descriptionInput = new TextInputBuilder()
                .setCustomId('embed_description')
                .setLabel('Embed Description')
                .setStyle(TextInputStyle.Paragraph)
                .setValue(config.embedConfig.description || '{member} has added the vanity ({vanityURL}) to their status, their role has been added.')
                .setPlaceholder('Enter a description for your embed. Use {member}, {vanityURL}, etc.')
                .setRequired(true);

            // Color input
            const colorInput = new TextInputBuilder()
                .setCustomId('embed_color')
                .setLabel('Embed Color (hex code, e.g. #5865F2)')
                .setStyle(TextInputStyle.Short)
                .setValue(config.embedConfig.color || '#5865F2')
                .setPlaceholder('#5865F2')
                .setRequired(true);

            // Add inputs to modal
            modal.addComponents(
                new ActionRowBuilder().addComponents(descriptionInput),
                new ActionRowBuilder().addComponents(colorInput)
            );

            await interaction.showModal(modal);
            return;
        }
    }

    else if (commandName === 'feedback') {
        const subcommand = options.getSubcommand();

        if (subcommand === 'setup') {
            const staffRole = options.getRole('staff_role');
            const feedbackWall = options.getChannel('feedback_wall');
            const feedbackLog = options.getChannel('feedback_log');

            // Store the configuration
            const guildId = interaction.guild.id;
            feedbackConfig.set(guildId, {
                staffRoleId: staffRole.id,
                feedbackWallId: feedbackWall.id,
                feedbackLogId: feedbackLog?.id
            });

            // Send instructional embed to the feedback wall
            try {
                // Create the instructional embed with the new format
                const instructionEmbed = new EmbedBuilder()
                    .setTitle('📋 Staff Commands')
                    .setDescription('**Staff Commands**\n\n`/staff-upvote` - Upvote a staff member\n• Use this command to recognize good performance\n• Upvotes increase a staff member\'s reputation\n\n`/staff-downvote` - Downvote a staff member\n• Use this command to report issues or poor performance\n• Downvotes decrease a staff member\'s reputation')
                    .setColor('#5865F2')
                    .setTimestamp();

                // Send the embed to the feedback wall channel
                await feedbackWall.send({ embeds: [instructionEmbed] });
            } catch (error) {
                console.error('Error sending instructional embed to feedback wall:', error);
            }

            return interaction.reply({
                content: `Staff Feedback system has been set up successfully!`,
                ephemeral: true
            });
        }
    }

    else if (commandName === 'staff') {
        const subcommand = options.getSubcommand();
        const staffMember = options.getUser('staff_member');
        const reason = options.getString('reason');
        const guildId = interaction.guild.id;

        // Check if the feedback system is set up
        const config = feedbackConfig.get(guildId);
        if (!config) {
            return interaction.reply({
                content: 'The Staff Feedback system has not been set up yet.',
                ephemeral: true
            });
        }

        // Initialize feedback data if needed
        if (!staffFeedback.has(staffMember.id)) {
            staffFeedback.set(staffMember.id, {
                upvotes: [],
                downvotes: []
            });
        }

        const feedbackData = staffFeedback.get(staffMember.id);

        // Handle upvote or downvote
        const isUpvote = subcommand === 'upvote';
        const timestamp = new Date();

        if (isUpvote) {
            // Add the upvote
            feedbackData.upvotes.push({
                userId: interaction.user.id,
                reason: reason,
                timestamp: timestamp
            });
        } else {
            // Add the downvote
            feedbackData.downvotes.push({
                userId: interaction.user.id,
                reason: reason,
                timestamp: timestamp
            });
        }

        // Update the feedback data in memory
        staffFeedback.set(staffMember.id, feedbackData);

        // First, reply to the user
        await interaction.reply({
            content: `You have successfully ${isUpvote ? 'upvoted' : 'downvoted'} ${staffMember}.`,
            ephemeral: true
        });

        // Update the feedback wall with consolidated embed
        try {
            const feedbackWallChannel = await interaction.guild.channels.fetch(config.feedbackWallId);
            if (feedbackWallChannel) {
                // Find existing messages in the feedback wall channel
                const messages = await feedbackWallChannel.messages.fetch({ limit: 100 });

                // Find the consolidated staff feedback message (look for "Staff Feedback Wall" title)
                const consolidatedMessage = messages.find(msg =>
                    msg.embeds.length > 0 &&
                    msg.embeds[0].title &&
                    msg.embeds[0].title.includes('Staff Feedback Wall')
                );

                // Build the consolidated embed with all staff members
                const embed = new EmbedBuilder()
                    .setTitle('📊 Staff Feedback Wall')
                    .setDescription('Current ratings for all staff members')
                    .setColor('#5865F2')
                    .setTimestamp();

                // Add a field for each staff member who has feedback
                const staffEntries = [];
                for (const [staffId, data] of staffFeedback.entries()) {
                    try {
                        const staff = await interaction.guild.members.fetch(staffId);
                        const upvoteCount = data.upvotes.length;
                        const downvoteCount = data.downvotes.length;
                        const netScore = upvoteCount - downvoteCount;

                        staffEntries.push({
                            name: `${staff.user.username}`,
                            value: `👍 ${upvoteCount} | 👎 ${downvoteCount} | Net: ${netScore >= 0 ? '+' : ''}${netScore}`,
                            inline: false
                        });
                    } catch (err) {
                        console.error(`Error fetching staff member ${staffId}:`, err);
                    }
                }

                // Sort by net score (highest first)
                staffEntries.sort((a, b) => {
                    const aNet = parseInt(a.value.match(/Net: ([+-]?\d+)/)[1]);
                    const bNet = parseInt(b.value.match(/Net: ([+-]?\d+)/)[1]);
                    return bNet - aNet;
                });

                // Add all staff entries to the embed
                if (staffEntries.length > 0) {
                    embed.addFields(staffEntries);
                } else {
                    embed.setDescription('No staff feedback yet. Use `/staff upvote` or `/staff downvote` to rate staff members.');
                }

                if (consolidatedMessage) {
                    // Update the existing consolidated message
                    await consolidatedMessage.edit({ embeds: [embed] });
                } else {
                    // Create a new consolidated message
                    await feedbackWallChannel.send({ embeds: [embed] });
                }
            }
        } catch (error) {
            console.error('Error updating feedback wall:', error);
        }

        // Then, send to feedback logs if configured
        if (config.feedbackLogId) {
            try {
                const feedbackLogChannel = await interaction.guild.channels.fetch(config.feedbackLogId);
                if (feedbackLogChannel) {
                    const embed = new EmbedBuilder()
                        .setTitle(`Staff ${isUpvote ? 'Upvote' : 'Downvote'}`)
                        .setColor(isUpvote ? '#00FF00' : '#FF0000')
                        .setDescription(`${interaction.user} has ${isUpvote ? 'upvoted' : 'downvoted'} ${staffMember}`)
                        .addFields(
                            { name: 'Staff Member', value: `${staffMember.username} (${staffMember.id})`, inline: false },
                            { name: 'Submitted By', value: `${interaction.user.username} (${interaction.user.id})`, inline: false },
                            { name: 'Reason', value: reason, inline: false }
                        )
                        .setTimestamp(timestamp);

                    await feedbackLogChannel.send({ embeds: [embed] });
                }
            } catch (error) {
                console.error('Error sending feedback to logs channel:', error);
            }
        }
    }

    else if (commandName === 'verification') {
        const subcommand = options.getSubcommand();

        if (subcommand === 'setup') {
            const channel = options.getChannel('channel');
            const role = options.getRole('role');
            const type = options.getString('type');

            // Store the configuration
            const guildId = interaction.guild.id;
            const config = {
                channelId: channel.id,
                roleId: role.id,
                type: type,
                embedConfig: {
                    title: 'Verification Required',
                    description: 'Please verify yourself to access the server.',
                    color: '#5865F2',
                    footer: 'Verification System'
                }
            };

            // Store in memory
            verificationConfig.set(guildId, config);

            // Store in database
            try {
                await VerificationConfig.findOneAndUpdate(
                    { guildId },
                    {
                        guildId,
                        ...config
                    },
                    { upsert: true, new: true }
                );
            } catch (error) {
                console.error('Error saving verification config:', error);
            }

            // Create basic verification embed
            const embed = new EmbedBuilder()
                .setTitle('Verification Required')
                .setDescription('Click the button below to verify yourself.')
                .setColor('#5865F2')
                .setFooter({ text: 'Verification System' });

            // Create verification button with the current guild ID
            // Use shortened type names for the button ID to avoid length issues
            let buttonType;
            if (type === VERIFICATION_TYPES.FIVEM_PASSPORT) {
                buttonType = 'fivem';
            } else if (type === VERIFICATION_TYPES.EMOJI_CAPTCHA) {
                buttonType = 'emoji';
            } else if (type === VERIFICATION_TYPES.IMAGE_CAPTCHA) {
                buttonType = 'image';
            } else {
                buttonType = type;
            }

            const verifyButton = new ButtonBuilder()
                .setCustomId(`verify_${buttonType}_${interaction.guild.id}`)
                .setLabel('Verify')
                .setStyle(ButtonStyle.Primary);

            const row = new ActionRowBuilder().addComponents(verifyButton);

            await channel.send({ embeds: [embed], components: [row] });

            return interaction.reply({
                content: `Verification system has been set up successfully!`,
                ephemeral: true
            });
        }

        else if (subcommand === 'embed') {
            const guildId = interaction.guild.id;
            const config = verificationConfig.get(guildId);

            if (!config) {
                return interaction.reply({
                    content: 'You need to set up the Verification Module first. Use `/verification setup` to configure it.',
                    ephemeral: true
                });
            }

            // Create a modal for customizing the embed
            const modal = new ModalBuilder()
                .setCustomId('verification_embed_config')
                .setTitle('Customize Verification Embed');

            // Title input
            const titleInput = new TextInputBuilder()
                .setCustomId('embed_title')
                .setLabel('Embed Title')
                .setStyle(TextInputStyle.Short)
                .setValue(config.embedConfig.title || 'Verification Required')
                .setRequired(true);

            // Description input
            const descriptionInput = new TextInputBuilder()
                .setCustomId('embed_description')
                .setLabel('Embed Description')
                .setStyle(TextInputStyle.Paragraph)
                .setValue(config.embedConfig.description || 'Please verify yourself to access the server.')
                .setRequired(true);

            // Color input
            const colorInput = new TextInputBuilder()
                .setCustomId('embed_color')
                .setLabel('Embed Color (hex code, e.g. #5865F2)')
                .setStyle(TextInputStyle.Short)
                .setValue(config.embedConfig.color || '#5865F2')
                .setRequired(true);

            // Footer input
            const footerInput = new TextInputBuilder()
                .setCustomId('embed_footer')
                .setLabel('Embed Footer Text')
                .setStyle(TextInputStyle.Short)
                .setValue(config.embedConfig.footer || 'Verification System')
                .setRequired(true);

            // Add inputs to modal
            modal.addComponents(
                new ActionRowBuilder().addComponents(titleInput),
                new ActionRowBuilder().addComponents(descriptionInput),
                new ActionRowBuilder().addComponents(colorInput),
                new ActionRowBuilder().addComponents(footerInput)
            );

            await interaction.showModal(modal);
            return;
        }
    }

    else if (commandName === 'restarts') {
        const subcommand = options.getSubcommand();

        if (subcommand === 'setup') {
            const channel = options.getChannel('channel');
            const connectLink = options.getString('connect_link');
            const role = options.getRole('role');

            // Extract CFX code from connect link
            const cfxMatch = connectLink.match(/cfx\.re\/join\/([a-zA-Z0-9]+)/);
            if (!cfxMatch) {
                return interaction.reply({
                    content: 'Invalid connect link format. Please provide a valid CFX.re link (e.g., cfx.re/join/abc123)',
                    ephemeral: true
                });
            }

            const cfxCode = cfxMatch[1];

            // Store the configuration
            const guildId = interaction.guild.id;
            const configData = {
                channelId: channel.id,
                connectLink: connectLink,
                cfxCode: cfxCode,
                roleId: role.id,
                lastPlayerCount: null // Track player count to detect restarts
            };

            restartsConfig.set(guildId, configData);

            // Save to database if connected
            try {
                if (db.isConnected()) {
                    await RestartsConfig.findOneAndUpdate(
                        { guildId },
                        configData,
                        { upsert: true, new: true }
                    );
                }
            } catch (error) {
                console.error('Error saving restarts config to database:', error);
                // Continue anyway - config is saved in memory
            }

            return interaction.reply({
                content: `Restarts Module has been set up successfully!\n\nThe bot will monitor the server at \`${connectLink}\` and send restart notifications to <#${channel.id}> pinging <@&${role.id}>`,
                ephemeral: true
            });
        }
    }

    else if (commandName === 'fivemstatus') {
        const subcommand = options.getSubcommand();

        if (subcommand === 'setup') {
            const channel = options.getChannel('channel');
            let cfxCodeInput = options.getString('cfx_code');

            const guildId = interaction.guild.id;

            // Extract CFX code if full link is provided
            let cfxCode = cfxCodeInput;
            const cfxMatch = cfxCodeInput.match(/cfx\.re\/join\/([a-zA-Z0-9]+)/);
            if (cfxMatch) {
                cfxCode = cfxMatch[1];
            }

            // Verify the CFX code works
            try {
                const response = await fetch(`https://servers-frontend.fivem.net/api/servers/single/${cfxCode}`);
                if (!response.ok) {
                    return interaction.reply({
                        content: 'Invalid CFX code. Please check your code and try again.',
                        ephemeral: true
                    });
                }

                const data = await response.json();
                if (!data.Data) {
                    return interaction.reply({
                        content: 'Could not fetch server data. Please check your CFX code and try again.',
                        ephemeral: true
                    });
                }

                // Create initial status embed
                const serverData = data.Data;
                const hostname = serverData.hostname || 'Unknown Server';
                const players = serverData.clients || 0;
                const maxPlayers = serverData.sv_maxclients || 200;
                const connectLink = `cfx.re/join/${cfxCode}`;

                // Get guild icon
                const guild = interaction.guild;
                const guildIcon = guild.iconURL({ dynamic: true, size: 1024 });

                const statusEmbed = new EmbedBuilder()
                    .setTitle('📊 Server Statistics')
                    .addFields(
                        { name: 'Server Status', value: '🟢 Online', inline: true },
                        { name: 'FiveM Status', value: '🟢 Operational', inline: true },
                        { name: 'Player Count', value: `[${players}/${maxPlayers}]`, inline: true },
                        { name: 'Refreshed', value: '<t:' + Math.floor(Date.now() / 1000) + ':R>', inline: true }
                    )
                    .setColor('#5865F2')
                    .setFooter({ text: `${hostname}` });

                // Add guild icon as image if available
                if (guildIcon) {
                    statusEmbed.setImage(guildIcon);
                }

                const connectButton = new ButtonBuilder()
                    .setLabel('Connect')
                    .setURL(`https://${connectLink}`)
                    .setStyle(ButtonStyle.Link);

                const row = new ActionRowBuilder().addComponents(connectButton);

                const statusMessage = await channel.send({
                    embeds: [statusEmbed],
                    components: [row]
                });

                // Save configuration
                const configData = {
                    channelId: channel.id,
                    messageId: statusMessage.id,
                    cfxCode: cfxCode
                };

                fivemStatusConfig.set(guildId, configData);

                // Save to database
                if (db.isConnected()) {
                    await FiveMStatusConfig.findOneAndUpdate(
                        { guildId },
                        configData,
                        { upsert: true, new: true }
                    );
                }

                return interaction.reply({
                    content: `FiveM Status Module has been set up successfully! The status will update automatically every minute in <#${channel.id}>`,
                    ephemeral: true
                });

            } catch (error) {
                console.error('Error setting up FiveM status:', error);
                return interaction.reply({
                    content: 'An error occurred while setting up the FiveM status module.',
                    ephemeral: true
                });
            }
        }
    }

    else if (commandName === 'modules') {
        const subcommand = options.getSubcommand();
        const guildId = interaction.guild.id;

        if (subcommand === 'enable') {
            const moduleName = options.getString('module');

            try {
                // Get or create module config
                let config = await ModuleConfig.findOne({ guildId });

                if (!config) {
                    config = new ModuleConfig({ guildId, disabledModules: [] });
                }

                // Remove module from disabled list if it exists
                if (config.disabledModules.includes(moduleName)) {
                    config.disabledModules = config.disabledModules.filter(m => m !== moduleName);
                    await config.save();

                    // Update in-memory config
                    moduleConfig.set(guildId, {
                        disabledModules: config.disabledModules
                    });

                    // Get affected commands
                    const affectedCommands = moduleCommands[moduleName] || [];
                    const commandsList = affectedCommands.map(cmd => `\`${cmd}\``).join(', ');

                    const embed = new EmbedBuilder()
                        .setTitle('✅ Module Enabled')
                        .setDescription(`The **${moduleName}** module has been enabled.`)
                        .addFields(
                            { name: 'Affected Commands', value: commandsList || 'None' }
                        )
                        .setColor('#00FF00')
                        .setTimestamp();

                    return interaction.reply({ embeds: [embed], ephemeral: true });
                } else {
                    return interaction.reply({
                        content: `The **${moduleName}** module is already enabled.`,
                        ephemeral: true
                    });
                }
            } catch (error) {
                console.error('Error enabling module:', error);
                return interaction.reply({
                    content: 'An error occurred while enabling the module.',
                    ephemeral: true
                });
            }
        }

        else if (subcommand === 'disable') {
            const moduleName = options.getString('module');

            try {
                // Get or create module config
                let config = await ModuleConfig.findOne({ guildId });

                if (!config) {
                    config = new ModuleConfig({ guildId, disabledModules: [] });
                }

                // Add module to disabled list if not already there
                if (!config.disabledModules.includes(moduleName)) {
                    config.disabledModules.push(moduleName);
                    await config.save();

                    // Update in-memory config
                    moduleConfig.set(guildId, {
                        disabledModules: config.disabledModules
                    });

                    // Get affected commands
                    const affectedCommands = moduleCommands[moduleName] || [];
                    const commandsList = affectedCommands.map(cmd => `\`${cmd}\``).join(', ');

                    const embed = new EmbedBuilder()
                        .setTitle('🔴 Module Disabled')
                        .setDescription(`The **${moduleName}** module has been disabled.`)
                        .addFields(
                            { name: 'Affected Commands', value: commandsList || 'None' }
                        )
                        .setColor('#FF0000')
                        .setTimestamp();

                    return interaction.reply({ embeds: [embed], ephemeral: true });
                } else {
                    return interaction.reply({
                        content: `The **${moduleName}** module is already disabled.`,
                        ephemeral: true
                    });
                }
            } catch (error) {
                console.error('Error disabling module:', error);
                return interaction.reply({
                    content: 'An error occurred while disabling the module.',
                    ephemeral: true
                });
            }
        }

        else if (subcommand === 'list') {
            try {
                // Get module config
                const config = await ModuleConfig.findOne({ guildId });
                const disabledModules = config?.disabledModules || [];

                // Build module list
                const moduleList = Object.keys(moduleCommands).map(moduleName => {
                    const status = disabledModules.includes(moduleName) ? '🔴 Disabled' : '✅ Enabled';
                    const commands = moduleCommands[moduleName].map(cmd => `\`${cmd}\``).join(', ');
                    return `**${moduleName}** - ${status}\n└ Commands: ${commands}`;
                }).join('\n\n');

                const embed = new EmbedBuilder()
                    .setTitle('📋 Module Status')
                    .setDescription(moduleList)
                    .setColor(global.brandingConfig && global.brandingConfig.embedConfig && global.brandingConfig.embedConfig.color ? global.brandingConfig.embedConfig.color : '#5865F2')
                    .setTimestamp();

                return interaction.reply({ embeds: [embed], ephemeral: true });
            } catch (error) {
                console.error('Error listing modules:', error);
                return interaction.reply({
                    content: 'An error occurred while listing modules.',
                    ephemeral: true
                });
            }
        }
    }

    else if (commandName === 'applications') {
        const subcommand = options.getSubcommand();

        if (subcommand === 'create') {
            const name = options.getString('name');
            const type = options.getString('type');
            const channel = options.getChannel('channel');
            const logsChannel = options.getChannel('logs');
            const role = options.getRole('role');
            const resultsChannel = options.getChannel('results');

            // Check if an application with this name already exists
            if (applicationPanels.has(name)) {
                return interaction.reply({
                    content: `An application panel with the name "${name}" already exists.`,
                    ephemeral: true
                });
            }

            // All application types are now presets

            // Create the application panel
            const preset = applicationPresets[type];
            const panelData = {
                name,
                type,
                channelId: channel.id,
                logsChannelId: logsChannel.id,
                roleId: role?.id,
                resultsChannelId: resultsChannel?.id,
                questions: preset.questions,
                title: preset.title,
                description: preset.description
            };

            // Store panel data in memory
            applicationPanels.set(name, panelData);

            // Store panel data in database
            const applicationPanel = new ApplicationPanel({
                guildId: interaction.guild.id,
                ...panelData
            });
            await applicationPanel.save();

            // Create and send the panel embed
            const embed = new EmbedBuilder()
                .setTitle(preset.title)
                .setDescription(preset.description)
                .setColor('#5865F2')
                .setFooter({ text: `Application ID: ${name}` });

            const applyButton = new ButtonBuilder()
                .setCustomId(`apply_${name}`)
                .setLabel('Apply')
                .setStyle(ButtonStyle.Primary);

            const row = new ActionRowBuilder().addComponents(applyButton);

            await channel.send({ embeds: [embed], components: [row] });

            return interaction.reply({
                content: `Application panel "${name}" has been created successfully in ${channel}.`,
                ephemeral: true
            });
        }

        else if (subcommand === 'delete') {
            const name = options.getString('name');

            // Check if the application exists
            if (!applicationPanels.has(name)) {
                return interaction.reply({
                    content: `No application panel found with the name "${name}".`,
                    ephemeral: true
                });
            }

            // Delete the application from memory
            applicationPanels.delete(name);

            // Delete the application from database
            await ApplicationPanel.deleteOne({ guildId: interaction.guild.id, name });

            return interaction.reply({
                content: `Application panel "${name}" has been deleted.`,
                ephemeral: true
            });
        }

        else if (subcommand === 'multi') {
            const channel = options.getChannel('channel');
            const title = options.getString('title');

            // Get all available application panels
            if (applicationPanels.size === 0) {
                return interaction.reply({
                    content: 'No application panels have been created yet.',
                    ephemeral: true
                });
            }

            // Create multi-panel select menu
            await interaction.reply({
                content: 'Select which application panels to include in your multi-panel:',
                components: [createMultiPanelSelectMenu(title, channel.id)],
                ephemeral: true
            });
        }
    }
});

// Create a select menu for multi-panel creation
function createMultiPanelSelectMenu(title, channelId) {
    const options = [];

    // Add all application panels as options
    for (const [name, panel] of applicationPanels.entries()) {
        options.push({
            label: panel.title,
            description: `Application ID: ${name}`,
            value: name
        });
    }

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`multipanel_${title}_${channelId}`)
        .setPlaceholder('Select application panels to include')
        .setMinValues(1)
        .setMaxValues(Math.min(options.length, 25)) // Discord allows max 25 options
        .addOptions(options);

    return new ActionRowBuilder().addComponents(selectMenu);
}

// Handle button interactions (application submissions)
client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;

    // Handle poll voting
    if (interaction.customId === 'poll_upvote' || interaction.customId === 'poll_downvote') {
        const guildId = interaction.guild.id;
        const messageId = interaction.message.id;

        try {
            // Find the poll
            const poll = await Poll.findOne({ messageId, guildId });
            if (!poll || !poll.active) {
                return interaction.reply({
                    content: 'This poll is no longer active.',
                    ephemeral: true
                });
            }

            const userId = interaction.user.id;
            const isUpvote = interaction.customId === 'poll_upvote';

            // Check if user has already voted
            const hasUpvoted = poll.upvotes.includes(userId);
            const hasDownvoted = poll.downvotes.includes(userId);

            // Defer the update to prevent interaction timeout
            await interaction.deferUpdate();

            let responseMessage = '';

            // Handle vote changes
            if (isUpvote) {
                if (hasUpvoted) {
                    // Remove upvote if already upvoted
                    poll.upvotes = poll.upvotes.filter(id => id !== userId);
                    await poll.save();
                    responseMessage = 'Your upvote has been removed.';
                } else {
                    // Add upvote and remove downvote if exists
                    if (hasDownvoted) {
                        poll.downvotes = poll.downvotes.filter(id => id !== userId);
                    }

                    poll.upvotes.push(userId);
                    await poll.save();
                    responseMessage = 'Your vote has been recorded as an upvote.';
                }
            } else {
                if (hasDownvoted) {
                    // Remove downvote if already downvoted
                    poll.downvotes = poll.downvotes.filter(id => id !== userId);
                    await poll.save();
                    responseMessage = 'Your downvote has been removed.';
                } else {
                    // Add downvote and remove upvote if exists
                    if (hasUpvoted) {
                        poll.upvotes = poll.upvotes.filter(id => id !== userId);
                    }

                    poll.downvotes.push(userId);
                    await poll.save();
                    responseMessage = 'Your vote has been recorded as a downvote.';
                }
            }

            // Send a followUp message to notify the user
            await interaction.followUp({
                content: responseMessage,
                ephemeral: true
            });

            // Update the poll embed
            const embed = EmbedBuilder.from(interaction.message.embeds[0]);

            // Clear existing fields and add new ones
            embed.setFields(
                { name: '👍 Upvotes', value: `${poll.upvotes.length}`, inline: true },
                { name: '👎 Downvotes', value: `${poll.downvotes.length}`, inline: true }
            );

            await interaction.message.edit({
                embeds: [embed]
            });
        } catch (error) {
            console.error('Error handling poll vote:', error);
            try {
                // Check if the interaction has already been replied to
                if (interaction.replied || interaction.deferred) {
                    return await interaction.followUp({
                        content: 'An error occurred while processing your vote.',
                        ephemeral: true
                    });
                } else {
                    return await interaction.reply({
                        content: 'An error occurred while processing your vote.',
                        ephemeral: true
                    });
                }
            } catch (followUpError) {
                console.error('Error sending error message:', followUpError);
            }
        }
    }

    // Handle suggestion voting buttons
    else if (interaction.customId.startsWith('suggestion_upvote_') || interaction.customId.startsWith('suggestion_downvote_')) {
        const guildId = interaction.guild.id;
        const messageId = interaction.message.id;

        try {
            // Find the suggestion
            const suggestion = await Suggestion.findOne({ messageId, guildId });
            if (!suggestion) {
                return interaction.reply({
                    content: 'This suggestion could not be found.',
                    ephemeral: true
                });
            }

            const userId = interaction.user.id;
            const isUpvote = interaction.customId.startsWith('suggestion_upvote_');

            // Check if user has already voted
            const hasUpvoted = suggestion.upvotes.includes(userId);
            const hasDownvoted = suggestion.downvotes.includes(userId);

            // Defer the update to prevent interaction timeout
            await interaction.deferUpdate();

            // Handle vote changes
            if (isUpvote) {
                if (hasUpvoted) {
                    // Remove upvote if already upvoted
                    suggestion.upvotes = suggestion.upvotes.filter(id => id !== userId);
                } else {
                    // Add upvote and remove downvote if exists
                    if (hasDownvoted) {
                        suggestion.downvotes = suggestion.downvotes.filter(id => id !== userId);
                    }
                    suggestion.upvotes.push(userId);
                }
            } else {
                if (hasDownvoted) {
                    // Remove downvote if already downvoted
                    suggestion.downvotes = suggestion.downvotes.filter(id => id !== userId);
                } else {
                    // Add downvote and remove upvote if exists
                    if (hasUpvoted) {
                        suggestion.upvotes = suggestion.upvotes.filter(id => id !== userId);
                    }
                    suggestion.downvotes.push(userId);
                }
            }

            await suggestion.save();

            // Update the embed with new vote counts
            const upvoteCount = suggestion.upvotes.length;
            const downvoteCount = suggestion.downvotes.length;

            const updatedEmbed = new EmbedBuilder()
                .setTitle('New Suggestion')
                .setDescription(suggestion.suggestion)
                .setColor('#5865F2')
                .addFields(
                    { name: 'Upvotes', value: `${upvoteCount}`, inline: true },
                    { name: 'Downvotes', value: `${downvoteCount}`, inline: true }
                )
                .setFooter({ text: `Suggested by ${interaction.message.embeds[0].footer.text.replace('Suggested by ', '')}` })
                .setTimestamp();

            // Update buttons with new counts
            const upvoteButton = new ButtonBuilder()
                .setCustomId(`suggestion_upvote_${suggestion.userId}`)
                .setLabel(`Upvoted (${upvoteCount})`)
                .setStyle(ButtonStyle.Success);

            const downvoteButton = new ButtonBuilder()
                .setCustomId(`suggestion_downvote_${suggestion.userId}`)
                .setLabel(`Downvoted (${downvoteCount})`)
                .setStyle(ButtonStyle.Danger);

            const row = new ActionRowBuilder()
                .addComponents(upvoteButton, downvoteButton);

            // Update the message
            await interaction.message.edit({
                embeds: [updatedEmbed],
                components: [row]
            });

        } catch (error) {
            console.error('Error handling suggestion vote:', error);
            try {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({
                        content: 'An error occurred while processing your vote.',
                        ephemeral: true
                    });
                }
            } catch (followUpError) {
                console.error('Error sending error message:', followUpError);
            }
        }
    }

    // Handle template buttons
    else if (interaction.customId.startsWith('template_send_')) {
        const channelId = interaction.customId.replace('template_send_', '');
        const channel = await interaction.guild.channels.fetch(channelId);

        if (!channel) {
            return interaction.reply({
                content: 'Channel not found. Please try again.',
                ephemeral: true
            });
        }

        // Get the template data from memory
        if (!client.templateData || !client.templateData.has(interaction.user.id)) {
            return interaction.reply({
                content: 'Template data not found. Please try again.',
                ephemeral: true
            });
        }

        const templateData = client.templateData.get(interaction.user.id);

        try {
            // Create the embed
            const embed = new EmbedBuilder()
                .setTitle(templateData.title)
                .setDescription(templateData.description)
                .setColor(templateData.color);

            // Apply branding color but not the image
            if (global.brandingConfig && global.brandingConfig.embedConfig && global.brandingConfig.embedConfig.color) {
                embed.setColor(global.brandingConfig.embedConfig.color);
            }

            // Apply footer if set (but not timestamp)
            if (global.brandingConfig && global.brandingConfig.embedConfig && global.brandingConfig.embedConfig.footer) {
                embed.setFooter({ text: global.brandingConfig.embedConfig.footer });
            }

            // Send the embed to the channel
            await channel.send({ embeds: [embed] });

            // Clean up the template data
            client.templateData.delete(interaction.user.id);

            return interaction.update({
                content: `Template embed sent successfully to ${channel}!`,
                embeds: [],
                components: []
            });
        } catch (error) {
            console.error('Error sending template embed:', error);
            return interaction.reply({
                content: 'An error occurred while sending the template embed.',
                ephemeral: true
            });
        }
    }
    else if (interaction.customId === 'template_cancel') {
        // Clean up the template data
        if (client.templateData && client.templateData.has(interaction.user.id)) {
            client.templateData.delete(interaction.user.id);
        }

        return interaction.update({
            content: 'Template creation cancelled.',
            embeds: [],
            components: []
        });
    }

    // Handle embed buttons
    else if (interaction.customId === 'embed_add_link') {
        // Create a modal for adding a link button
        const modal = new ModalBuilder()
            .setCustomId(`embed_add_link_${interaction.message.id}`)
            .setTitle('Add Link Button');

        // Button label input
        const labelInput = new TextInputBuilder()
            .setCustomId('button_label')
            .setLabel('Button Label')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder('Enter a label for your button');

        // Button URL input
        const urlInput = new TextInputBuilder()
            .setCustomId('button_url')
            .setLabel('Button URL')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder('Enter a URL for your button');

        // Button emoji input
        const emojiInput = new TextInputBuilder()
            .setCustomId('button_emoji')
            .setLabel('Button Emoji (optional)')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setPlaceholder('Enter an emoji for your button');

        // Add inputs to modal
        modal.addComponents(
            new ActionRowBuilder().addComponents(labelInput),
            new ActionRowBuilder().addComponents(urlInput),
            new ActionRowBuilder().addComponents(emojiInput)
        );

        await interaction.showModal(modal);
        return;
    }
    else if (interaction.customId === 'embed_send') {
        try {
            // Get the embed data from the database
            const embedData = await Embed.findOne({ messageId: interaction.message.id });

            if (!embedData) {
                return interaction.reply({
                    content: 'Embed data not found. Please try again.',
                    ephemeral: true
                });
            }

            // Get the target channel
            const channel = await interaction.guild.channels.fetch(embedData.channelId);

            if (!channel) {
                return interaction.reply({
                    content: 'Target channel not found. Please try again.',
                    ephemeral: true
                });
            }

            // Create the embed
            const embed = new EmbedBuilder();

            if (embedData.title) embed.setTitle(embedData.title);
            if (embedData.description) embed.setDescription(embedData.description);
            if (embedData.color) embed.setColor(embedData.color);
            if (embedData.footer) embed.setFooter({ text: embedData.footer });
            if (embedData.image) embed.setImage(embedData.image);

            // Create buttons for the embed
            const buttons = [];

            for (const button of embedData.buttons) {
                const linkButton = new ButtonBuilder()
                    .setLabel(button.label)
                    .setURL(button.url)
                    .setStyle(ButtonStyle.Link);

                if (button.emoji) {
                    linkButton.setEmoji(button.emoji);
                }

                buttons.push(linkButton);
            }

            // Create action rows for the buttons (max 5 buttons per row)
            const buttonRows = [];
            for (let i = 0; i < buttons.length; i += 5) {
                const row = new ActionRowBuilder().addComponents(buttons.slice(i, i + 5));
                buttonRows.push(row);
            }

            // Send the embed to the target channel
            const sentMessage = await channel.send({
                embeds: [embed],
                components: buttonRows
            });

            // Update the embed data with the new message ID
            embedData.messageId = sentMessage.id;
            await embedData.save();

            return interaction.update({
                content: `Embed sent successfully to ${channel}!`,
                embeds: [],
                components: []
            });
        } catch (error) {
            console.error('Error sending embed:', error);
            return interaction.reply({
                content: 'An error occurred while sending the embed.',
                ephemeral: true
            });
        }
    }

    // Handle verification buttons
    if (interaction.customId.startsWith('verify_')) {
        const parts = interaction.customId.split('_');
        const type = parts[1];
        const guildId = parts[2];


        // Try to get config using the guild ID from the button
        let config = verificationConfig.get(guildId);

        // If not found, try using the current guild ID
        if (!config) {
            config = verificationConfig.get(interaction.guild.id);
        }

        // If still not found, try to load from database
        if (!config) {
            try {
                // Try to find the config in the database
                const dbConfig = await VerificationConfig.findOne({ guildId: interaction.guild.id });

                if (dbConfig) {
                    config = {
                        channelId: dbConfig.channelId,
                        roleId: dbConfig.roleId,
                        type: dbConfig.type,
                        embedConfig: dbConfig.embedConfig
                    };

                    // Store in memory for future use
                    verificationConfig.set(interaction.guild.id, config);
                }
            } catch (error) {
                console.error('Error loading verification config from database:', error);
            }
        }

        if (!config) {
            return interaction.reply({
                content: 'Verification system is not properly configured. Please ask an administrator to set up verification again.',
                ephemeral: true
            });
        }

        // Handle different verification types
        // Convert type to uppercase for comparison if needed
        let normalizedType;
        if (type.toUpperCase() === 'FIVEM') {
            normalizedType = 'FIVEM_PASSPORT';
        } else if (type.toUpperCase() === 'EMOJI') {
            normalizedType = 'EMOJI_CAPTCHA';
        } else if (type.toUpperCase() === 'IMAGE') {
            normalizedType = 'IMAGE_CAPTCHA';
        } else {
            normalizedType = type.toUpperCase();
        }

        switch (normalizedType) {
            case 'SIMPLE':
                // Simple verification - just assign the role
                try {
                    const role = await interaction.guild.roles.fetch(config.roleId);
                    if (role) {
                        await interaction.member.roles.add(role);
                        return interaction.reply({
                            content: 'You have been successfully verified!',
                            ephemeral: true
                        });
                    }
                } catch (error) {
                    console.error('Failed to assign verification role:', error);
                    return interaction.reply({
                        content: 'An error occurred during verification. Please contact an administrator.',
                        ephemeral: true
                    });
                }
                break;

            case 'FIVEM_PASSPORT':
                // FiveM Passport - show modal for RP name
                const passportModal = new ModalBuilder()
                    .setCustomId(`passport_verify_${interaction.guild.id}`)
                    .setTitle('FiveM Passport Verification');

                const firstNameInput = new TextInputBuilder()
                    .setCustomId('first_name')
                    .setLabel('First Name')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                const lastNameInput = new TextInputBuilder()
                    .setCustomId('last_name')
                    .setLabel('Last Name')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                passportModal.addComponents(
                    new ActionRowBuilder().addComponents(firstNameInput),
                    new ActionRowBuilder().addComponents(lastNameInput)
                );

                await interaction.showModal(passportModal);
                return;

            case 'EMOJI_CAPTCHA':
                // Emoji Captcha - create a random emoji challenge
                // Select 4 random emojis from the list
                const selectedEmojis = [];
                const emojisCopy = [...CAPTCHA_EMOJIS];

                for (let i = 0; i < 4; i++) {
                    const randomIndex = Math.floor(Math.random() * emojisCopy.length);
                    selectedEmojis.push(emojisCopy[randomIndex]);
                    emojisCopy.splice(randomIndex, 1);
                }

                // Choose one of the selected emojis as the correct answer
                const correctIndex = Math.floor(Math.random() * 4);
                const correctEmoji = selectedEmojis[correctIndex];

                // Create buttons for each emoji
                const emojiButtons = selectedEmojis.map((emoji, index) => {
                    return new ButtonBuilder()
                        .setCustomId(`emoji_captcha_${index === correctIndex ? 'correct' : 'wrong'}_${index}_${interaction.guild.id}`)
                        .setLabel(emoji)
                        .setStyle(ButtonStyle.Secondary);
                });

                const emojiRow = new ActionRowBuilder().addComponents(emojiButtons);

                return interaction.reply({
                    content: `Please select the ${correctEmoji} emoji to verify yourself. You have 30 seconds.`,
                    components: [emojiRow],
                    ephemeral: true
                });

            case 'IMAGE_CAPTCHA':
                // Image Captcha - create a shape-based verification challenge
                try {
                    // Generate a random index for the correct shape (0-3)
                    const correctShapeIndex = Math.floor(Math.random() * 4);

                    // Generate the verification image with shapes
                    const verificationImage = await generateVerificationImage(correctShapeIndex);

                    // Create an attachment from the image
                    const attachment = new AttachmentBuilder(verificationImage.path, { name: 'captcha.png' });

                    // Shape names for the buttons
                    const shapeNames = ['Circle', 'Square', 'Triangle', 'Star'];

                    // Create buttons for each shape option
                    const shapeButtons = shapeNames.map((shape, index) => {
                        return new ButtonBuilder()
                            .setCustomId(`image_captcha_${index === correctShapeIndex ? 'correct' : 'wrong'}_${index}_${interaction.guild.id}`)
                            .setLabel(shape)
                            .setStyle(ButtonStyle.Primary);
                    });

                    const buttonRow = new ActionRowBuilder().addComponents(shapeButtons);

                    // Create the embed with the generated image
                    const captchaEmbed = new EmbedBuilder()
                        .setTitle('Verification Required')
                        .setDescription(`Select the highlighted shape from the options below. Expires in 30 seconds.`)
                        .setColor('#5865F2')
                        .setImage('attachment://captcha.png');

                    return interaction.reply({
                        embeds: [captchaEmbed],
                        files: [attachment],
                        components: [buttonRow],
                        ephemeral: true
                    });
                } catch (error) {
                    console.error('Error generating verification image:', error);

                    // Fallback to a simple text-based verification
                    const options = ['Red', 'Blue', 'Green', 'Yellow'];
                    const correctIndex = Math.floor(Math.random() * 4);

                    // Create buttons for each color option
                    const fallbackButtons = options.map((color, index) => {
                        return new ButtonBuilder()
                            .setCustomId(`image_captcha_${index === correctIndex ? 'correct' : 'wrong'}_${index}_${interaction.guild.id}`)
                            .setLabel(color)
                            .setStyle(ButtonStyle.Primary);
                    });

                    const fallbackRow = new ActionRowBuilder().addComponents(fallbackButtons);

                    // Create a simple embed without an image
                    const fallbackEmbed = new EmbedBuilder()
                        .setTitle('Verification Required')
                        .setDescription(`Please select the color ${options[correctIndex]} from the options below. Expires in 30 seconds.`)
                        .setColor('#5865F2');

                    return interaction.reply({
                        embeds: [fallbackEmbed],
                        components: [fallbackRow],
                        ephemeral: true
                    });
                }

            default:
                return interaction.reply({
                    content: `Unknown verification type: ${type}. Please contact an administrator.`,
                    ephemeral: true
                });
        }
    }

    // Handle emoji captcha responses
    else if (interaction.customId.startsWith('emoji_captcha_')) {
        const parts = interaction.customId.split('_');
        const result = parts[2]; // 'correct' or 'wrong'
        const buttonIndex = parts[3]; // Button index
        const guildId = parts[4];

        // Try to get config using the guild ID from the button
        let config = verificationConfig.get(guildId);

        // If not found, try using the current guild ID
        if (!config) {
            config = verificationConfig.get(interaction.guild.id);
        }

        // If still not found, try to load from database
        if (!config) {
            try {
                // Try to find the config in the database
                const dbConfig = await VerificationConfig.findOne({ guildId: interaction.guild.id });

                if (dbConfig) {
                    config = {
                        channelId: dbConfig.channelId,
                        roleId: dbConfig.roleId,
                        type: dbConfig.type,
                        embedConfig: dbConfig.embedConfig
                    };

                    // Store in memory for future use
                    verificationConfig.set(interaction.guild.id, config);
                }
            } catch (error) {
                console.error('Error loading verification config from database:', error);
            }
        }

        if (!config) {
            return interaction.reply({
                content: 'Verification system is not properly configured. Please ask an administrator to set up verification again.',
                ephemeral: true
            });
        }

        if (result === 'correct') {
            // Assign the verification role
            try {
                const role = await interaction.guild.roles.fetch(config.roleId);
                if (role) {
                    await interaction.member.roles.add(role);
                    await interaction.update({
                        content: 'Captcha completed successfully! You have been verified.',
                        components: []
                    });
                }
            } catch (error) {
                console.error('Failed to assign verification role:', error);
                await interaction.update({
                    content: 'An error occurred during verification. Please contact an administrator.',
                    components: []
                });
            }
        } else {
            // Wrong answer
            await interaction.update({
                content: 'Incorrect selection. Please try again.',
                components: []
            });
        }

        return;
    }

    // Handle image captcha responses
    else if (interaction.customId.startsWith('image_captcha_')) {
        const parts = interaction.customId.split('_');
        const result = parts[2]; // 'correct' or 'wrong'
        const buttonIndex = parts[3]; // Button index
        const guildId = parts[4];

        // Try to get config using the guild ID from the button
        let config = verificationConfig.get(guildId);

        // If not found, try using the current guild ID
        if (!config) {
            config = verificationConfig.get(interaction.guild.id);
        }

        // If still not found, try to load from database
        if (!config) {
            try {
                // Try to find the config in the database
                const dbConfig = await VerificationConfig.findOne({ guildId: interaction.guild.id });

                if (dbConfig) {
                    config = {
                        channelId: dbConfig.channelId,
                        roleId: dbConfig.roleId,
                        type: dbConfig.type,
                        embedConfig: dbConfig.embedConfig
                    };

                    // Store in memory for future use
                    verificationConfig.set(interaction.guild.id, config);
                }
            } catch (error) {
                console.error('Error loading verification config from database:', error);
            }
        }

        if (!config) {
            return interaction.reply({
                content: 'Verification system is not properly configured. Please ask an administrator to set up verification again.',
                ephemeral: true
            });
        }

        // Try to find and clean up any temporary verification images
        try {
            // Check the temp directory for any verification images
            const tempDir = path.join(__dirname, 'temp');

            // Create the directory if it doesn't exist
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
                // No files to clean up if we just created the directory
                console.log('Created temp directory for verification images');
            } else {
                // Look for verification image files
                const files = fs.readdirSync(tempDir);
                const verificationFiles = files.filter(file =>
                    file.startsWith('emoji_') || file.startsWith('verify_')
                );

                // Clean up old verification files (older than 1 hour)
                const now = Date.now();
                const oneHourAgo = now - (60 * 60 * 1000);

                for (const file of verificationFiles) {
                    const filePath = path.join(tempDir, file);
                    try {
                        const stats = fs.statSync(filePath);
                        // If file is older than 1 hour, delete it
                        if (stats.mtimeMs < oneHourAgo) {
                            fs.unlinkSync(filePath);
                            console.log(`Cleaned up old verification image: ${file}`);
                        }
                    } catch (fileError) {
                        // Ignore errors for individual files
                        console.log(`Could not check/delete file ${file}: ${fileError.message}`);
                    }
                }
            }
        } catch (error) {
            // Log the error but continue with verification
            console.log('Error during verification image cleanup:', error.message);
        }

        if (result === 'correct') {
            // Assign the verification role
            try {
                const role = await interaction.guild.roles.fetch(config.roleId);
                if (role) {
                    await interaction.member.roles.add(role);
                    await interaction.update({
                        content: 'Image captcha completed successfully! You have been verified.',
                        embeds: [],
                        components: []
                    });
                }

                // Clean up any recent verification images
                try {
                    const tempDir = path.join(__dirname, 'temp');
                    if (fs.existsSync(tempDir)) {
                        const files = fs.readdirSync(tempDir);
                        // Find verification files created in the last minute (likely from this verification)
                        const now = Date.now();
                        const oneMinuteAgo = now - (60 * 1000);

                        const recentFiles = files.filter(file => {
                            if (file.startsWith('verify_') || file.startsWith('emoji_')) {
                                try {
                                    const filePath = path.join(tempDir, file);
                                    const stats = fs.statSync(filePath);
                                    return stats.mtimeMs > oneMinuteAgo;
                                } catch (e) {
                                    return false;
                                }
                            }
                            return false;
                        });

                        // Delete the recent verification files
                        for (const file of recentFiles) {
                            try {
                                fs.unlinkSync(path.join(tempDir, file));
                                console.log(`Cleaned up verification image after successful verification: ${file}`);
                            } catch (e) {
                                console.log(`Could not delete file ${file}: ${e.message}`);
                            }
                        }
                    }
                } catch (cleanupError) {
                    console.log('Error cleaning up verification images:', cleanupError.message);
                }
            } catch (error) {
                console.error('Failed to assign verification role:', error);
                await interaction.update({
                    content: 'An error occurred during verification. Please contact an administrator.',
                    embeds: [],
                    components: []
                });
            }
        } else {
            // Wrong answer
            await interaction.update({
                content: 'Incorrect selection. Please try again.',
                embeds: [],
                components: []
            });
        }

        return;
    }

    // Handle application buttons
    else if (interaction.customId.startsWith('apply_')) {
        const panelName = interaction.customId.replace('apply_', '');
        const panel = applicationPanels.get(panelName);

        if (!panel) {
            return interaction.reply({
                content: 'This application panel no longer exists.',
                ephemeral: true
            });
        }

        // Check if this is a multi-step application (more than 5 questions)
        if (panel.questions.length > 5) {
            // For multi-step applications, we'll show the first 5 questions in the first step
            // Store the application state in memory for this user
            if (!client.applicationSteps) {
                client.applicationSteps = new Map();
            }

            // Store the user's application progress
            client.applicationSteps.set(interaction.user.id, {
                panelName,
                currentStep: 1,
                totalSteps: Math.ceil(panel.questions.length / 5),
                answers: {}
            });

            // Create modal with the first 5 questions
            const modal = new ModalBuilder()
                .setCustomId(`application_step_${panelName}_1`)
                .setTitle(`${panel.title} (Step 1/${Math.ceil(panel.questions.length / 5)})`);

            // Add the first 5 questions (or fewer if there aren't 5)
            const questionsForThisStep = panel.questions.slice(0, 5);
            questionsForThisStep.forEach(question => {
                const input = new TextInputBuilder()
                    .setCustomId(question.id)
                    .setLabel(question.label)
                    .setStyle(question.style)
                    .setRequired(true);

                modal.addComponents(new ActionRowBuilder().addComponents(input));
            });

            await interaction.showModal(modal);
        } else {
            // For applications with 5 or fewer questions, show all at once
            const modal = new ModalBuilder()
                .setCustomId(`application_${panelName}`)
                .setTitle(panel.title);

            // Add inputs for each question
            panel.questions.forEach(question => {
                const input = new TextInputBuilder()
                    .setCustomId(question.id)
                    .setLabel(question.label)
                    .setStyle(question.style)
                    .setRequired(true);

                modal.addComponents(new ActionRowBuilder().addComponents(input));
            });

            await interaction.showModal(modal);
        }
    }

    // Handle accept/deny buttons
    else if (interaction.customId.startsWith('accept_') || interaction.customId.startsWith('deny_')) {
        const isAccept = interaction.customId.startsWith('accept_');
        const responseId = interaction.customId.replace(isAccept ? 'accept_' : 'deny_', '');

        const response = applicationResponses.get(responseId);
        if (!response) {
            return interaction.reply({
                content: 'This application response no longer exists.',
                ephemeral: true
            });
        }

        // Create reason input modal
        const modal = new ModalBuilder()
            .setCustomId(`${isAccept ? 'acceptreason' : 'denyreason'}_${responseId}`)
            .setTitle(`${isAccept ? 'Accept' : 'Deny'} Application`);

        const reasonInput = new TextInputBuilder()
            .setCustomId('reason')
            .setLabel('Reason')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder(`Provide a reason for ${isAccept ? 'accepting' : 'denying'} this application`)
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));

        await interaction.showModal(modal);
    }

    // Handle continue application button
    else if (interaction.customId.startsWith('continue_application_')) {
        const parts = interaction.customId.split('_');
        const panelName = parts[2];
        const stepNumber = parseInt(parts[3]);
        const panel = applicationPanels.get(panelName);

        if (!panel) {
            return interaction.reply({
                content: 'This application panel no longer exists.',
                ephemeral: true
            });
        }

        // Get the user's application progress
        if (!client.applicationSteps) {
            client.applicationSteps = new Map();
        }

        let userProgress = client.applicationSteps.get(interaction.user.id);
        if (!userProgress) {
            return interaction.reply({
                content: `<@${interaction.user.id}> Your application session has expired. Please start again by clicking the Apply button.`,
                ephemeral: true
            });
        }

        // Verify the step number matches the user's progress
        if (stepNumber !== userProgress.currentStep) {
            return interaction.reply({
                content: `<@${interaction.user.id}> This step is no longer valid. Please start your application again by clicking the Apply button.`,
                ephemeral: true
            });
        }

        // Calculate which questions are in this step
        const startIndex = (stepNumber - 1) * 5;
        const endIndex = Math.min(startIndex + 5, panel.questions.length);
        const questionsForThisStep = panel.questions.slice(startIndex, endIndex);

        // Create modal for this step
        const modal = new ModalBuilder()
            .setCustomId(`application_step_${panelName}_${stepNumber}`)
            .setTitle(`${panel.title} (Step ${stepNumber}/${userProgress.totalSteps})`);

        // Add questions for this step
        questionsForThisStep.forEach(question => {
            const input = new TextInputBuilder()
                .setCustomId(question.id)
                .setLabel(question.label)
                .setStyle(question.style)
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(input));
        });

        await interaction.showModal(modal);
    }


    // Handle view application response button
    else if (interaction.customId.startsWith('view_')) {
        const responseId = interaction.customId.replace('view_', '');
        const response = applicationResponses.get(responseId);

        if (!response) {
            return interaction.reply({
                content: 'This application response no longer exists.',
                ephemeral: true
            });
        }

        // Create embeds to display the response
        const embeds = [];

        // Main info embed
        const infoEmbed = new EmbedBuilder()
            .setTitle(`Application Response - ${response.panelName}`)
            .setDescription(`Submitted by: <@${response.userId}>`)
            .setColor('#5865F2')
            .setTimestamp(response.timestamp)
            .setFooter({ text: `Response ID: ${responseId}` });

        embeds.push(infoEmbed);

        // Responses embed
        const responsesEmbed = new EmbedBuilder()
            .setTitle('Responses')
            .setColor('#5865F2');

        // Add each question and answer as field
        response.answers.forEach(answer => {
            responsesEmbed.addFields({
                name: answer.question,
                value: `\`${answer.answer || 'No response provided'}\``,
                inline: true
            });
        });

        embeds.push(responsesEmbed);

        await interaction.reply({ embeds, ephemeral: true });
    }
});

// Handle select menu interactions (multi-panel selection)
client.on('interactionCreate', async interaction => {
    if (!interaction.isStringSelectMenu()) return;

    if (interaction.customId.startsWith('multipanel_')) {
        const [_, title, channelId] = interaction.customId.split('_');
        const selectedPanels = interaction.values;

        // Create multi-panel embed
        const embed = new EmbedBuilder()
            .setTitle(title)
            .setDescription('Welcome to **Applications Manager**. Heres Your chance yo apply for a role in our server below. Simply press the appropriate application below in order to start the application process.')
            .setColor('#5865F2');

        // Apply branding (including banner if set)
        applyBranding(embed);

        // Create buttons for each selected panel
        const rows = [];
        let currentRow = new ActionRowBuilder();
        let buttonCount = 0;

        for (const panelName of selectedPanels) {
            const panel = applicationPanels.get(panelName);
            if (!panel) continue;

            const button = new ButtonBuilder()
                .setCustomId(`apply_${panelName}`)
                .setLabel(panel.title)
                .setStyle(ButtonStyle.Primary);

            // Discord allows max 5 buttons per row
            if (buttonCount === 5) {
                rows.push(currentRow);
                currentRow = new ActionRowBuilder();
                buttonCount = 0;
            }

            currentRow.addComponents(button);
            buttonCount++;
        }

        // Add the last row if it has any buttons
        if (buttonCount > 0) {
            rows.push(currentRow);
        }

        // Get the channel and send the multi-panel
        const channel = await client.channels.fetch(channelId);
        await channel.send({ embeds: [embed], components: rows });

        return interaction.update({
            content: `Multi-panel created successfully in ${channel}.`,
            components: []
        });
    }
});

// Handle modal submissions
client.on('interactionCreate', async interaction => {
    if (!interaction.isModalSubmit()) return;

    // Handle embed creation modal
    if (interaction.customId.startsWith('embed_create_')) {
        const channelId = interaction.customId.replace('embed_create_', '');
        const channel = await interaction.guild.channels.fetch(channelId);

        if (!channel) {
            return interaction.reply({
                content: 'Channel not found. Please try again.',
                ephemeral: true
            });
        }

        // Get values from the modal
        const title = interaction.fields.getTextInputValue('embed_title');
        const description = interaction.fields.getTextInputValue('embed_description');
        const color = interaction.fields.getTextInputValue('embed_color');
        const footer = interaction.fields.getTextInputValue('embed_footer');
        const imageUrl = interaction.fields.getTextInputValue('embed_image');

        // Create the embed
        const embed = new EmbedBuilder();

        if (title) embed.setTitle(title);
        if (description) embed.setDescription(description);
        if (color) {
            try {
                embed.setColor(color);
            } catch (error) {
                console.error('Invalid color format:', error);
                // Use default Discord blue color
                embed.setColor('#5865F2');
            }
        }
        if (footer) embed.setFooter({ text: footer });
        if (imageUrl && imageUrl.trim() !== '') {
            try {
                // Validate URL format
                new URL(imageUrl);
                embed.setImage(imageUrl);
            } catch (error) {
                console.error('Invalid image URL:', error);
                // Don't set the image if URL is invalid
            }
        }

        // Create buttons for adding links
        const addLinkButton = new ButtonBuilder()
            .setCustomId('embed_add_link')
            .setLabel('Add Link')
            .setStyle(ButtonStyle.Secondary);

        const sendEmbedButton = new ButtonBuilder()
            .setCustomId('embed_send')
            .setLabel('Send Embed')
            .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder().addComponents(addLinkButton, sendEmbedButton);

        // Store the embed data temporarily
        const embedData = {
            title,
            description,
            color,
            footer,
            imageUrl,
            buttons: []
        };

        // Send a preview of the embed
        const previewMessage = await interaction.reply({
            content: 'Here\'s a preview of your embed. You can add buttons or send it as is.',
            embeds: [embed],
            components: [row],
            ephemeral: true,
            fetchReply: true
        });

        // Store the embed data in the database
        await Embed.create({
            guildId: interaction.guild.id,
            messageId: previewMessage.id,
            channelId: channel.id,
            title,
            description,
            color,
            footer,
            image: imageUrl,
            buttons: []
        });

        return;
    }

    // Handle embed editing modal
    else if (interaction.customId.startsWith('embed_edit_')) {
        const parts = interaction.customId.replace('embed_edit_', '').split('_');
        const channelId = parts[0];
        const messageId = parts[1];

        const channel = await interaction.guild.channels.fetch(channelId);

        if (!channel) {
            return interaction.reply({
                content: 'Channel not found. Please try again.',
                ephemeral: true
            });
        }

        try {
            // Fetch the message to edit
            const message = await channel.messages.fetch(messageId);

            if (!message) {
                return interaction.reply({
                    content: 'Message not found. Please check the message ID and channel.',
                    ephemeral: true
                });
            }

            // Get values from the modal
            const title = interaction.fields.getTextInputValue('embed_title');
            const description = interaction.fields.getTextInputValue('embed_description');
            const color = interaction.fields.getTextInputValue('embed_color');
            const footer = interaction.fields.getTextInputValue('embed_footer');
            const imageUrl = interaction.fields.getTextInputValue('embed_image');

            // Create the updated embed
            const embed = new EmbedBuilder();

            if (title) embed.setTitle(title);
            if (description) embed.setDescription(description);
            if (color) {
                try {
                    embed.setColor(color);
                } catch (error) {
                    console.error('Invalid color format:', error);
                    // Use default Discord blue color
                    embed.setColor('#5865F2');
                }
            }
            if (footer) embed.setFooter({ text: footer });
            if (imageUrl && imageUrl.trim() !== '') {
                try {
                    // Validate URL format
                    new URL(imageUrl);
                    embed.setImage(imageUrl);
                } catch (error) {
                    console.error('Invalid image URL:', error);
                    // Don't set the image if URL is invalid
                }
            }

            // Update the message with the new embed
            await message.edit({ embeds: [embed] });

            // Update or create the embed data in the database
            await Embed.findOneAndUpdate(
                { messageId },
                {
                    guildId: interaction.guild.id,
                    channelId,
                    title,
                    description,
                    color,
                    footer,
                    image: imageUrl
                },
                { upsert: true, new: true }
            );

            return interaction.reply({
                content: 'Embed updated successfully!',
                ephemeral: true
            });
        } catch (error) {
            console.error('Error updating embed:', error);
            return interaction.reply({
                content: 'An error occurred while updating the embed.',
                ephemeral: true
            });
        }
    }

    // Handle poll creation modal
    else if (interaction.customId === 'poll_create') {
        const guildId = interaction.guild.id;
        const channelId = interaction.channel.id;

        // Get values from the modal
        const question = interaction.fields.getTextInputValue('poll_question');

        try {
            // Create upvote and downvote buttons
            const upvoteButton = new ButtonBuilder()
                .setCustomId('poll_upvote')
                .setLabel('👍 Upvote')
                .setStyle(ButtonStyle.Success);

            const downvoteButton = new ButtonBuilder()
                .setCustomId('poll_downvote')
                .setLabel('👎 Downvote')
                .setStyle(ButtonStyle.Danger);

            const row = new ActionRowBuilder().addComponents(upvoteButton, downvoteButton);

            // Create the poll embed
            const embed = new EmbedBuilder()
                .setTitle(`\`\`${question}\`\``)
                .setDescription('Vote using the buttons below!')
                .addFields(
                    { name: '👍 Upvotes', value: '0', inline: true },
                    { name: '👎 Downvotes', value: '0', inline: true }
                )
                .setColor('#5865F2') // Discord Blue
                .setFooter({ text: `Created by ${interaction.user.tag}` })
                .setTimestamp();

            // Send the poll
            const pollMessage = await interaction.channel.send({
                embeds: [embed],
                components: [row]
            });

            // Save the poll to the database
            await Poll.create({
                guildId,
                channelId,
                messageId: pollMessage.id,
                question,
                creatorId: interaction.user.id,
                active: true,
                upvotes: [],
                downvotes: []
            });

            return interaction.reply({
                content: 'Poll created successfully!',
                ephemeral: true
            });
        } catch (error) {
            console.error('Error creating poll:', error);
            return interaction.reply({
                content: 'An error occurred while creating the poll.',
                ephemeral: true
            });
        }
    }

    // Handle welcome setup modal
    else if (interaction.customId === 'welcome_setup') {
        const guildId = interaction.guild.id;

        // Get values from the modal
        const message = interaction.fields.getTextInputValue('welcome_message');
        const title = interaction.fields.getTextInputValue('welcome_title');
        const description = interaction.fields.getTextInputValue('welcome_description');
        const color = interaction.fields.getTextInputValue('welcome_color');

        try {
            // Get the channel ID from the temporary storage
            const channelId = client.welcomeSetupChannel;

            if (!channelId) {
                return interaction.reply({
                    content: 'An error occurred during setup. Please try again.',
                    ephemeral: true
                });
            }

            // Find or create welcome config
            let welcomeConfig = await Welcome.findOne({ guildId });

            if (welcomeConfig) {
                // Update existing config
                welcomeConfig.channelId = channelId;
                welcomeConfig.message = message;
                welcomeConfig.embedConfig.title = title;
                welcomeConfig.embedConfig.description = description;
                welcomeConfig.embedConfig.color = color;

                await welcomeConfig.save();
            } else {
                // Create new config
                welcomeConfig = await Welcome.create({
                    guildId,
                    channelId,
                    message,
                    embedConfig: {
                        title,
                        description,
                        color
                    },
                    imageGeneration: true,
                    imageConfig: {
                        background: 'server',
                        textColor: '#FFFFFF',
                        overlayColor: 'rgba(0, 0, 0, 0.6)',
                        borderColor: 'transparent'
                    }
                });
            }

            // Create a preview of the welcome message
            const channel = await interaction.guild.channels.fetch(channelId);

            // Create a preview embed
            const embed = new EmbedBuilder()
                .setTitle(title.replace('{guild.name}', interaction.guild.name)
                    .replace('{memberCount}', interaction.guild.memberCount.toString()))
                .setDescription(description.replace('{member.mention}', interaction.user.toString())
                    .replace('{member.username}', interaction.user.username)
                    .replace('{member.id}', interaction.user.id)
                    .replace('{guild.name}', interaction.guild.name)
                    .replace('{guild.id}', interaction.guild.id)
                    .replace('{memberCount}', interaction.guild.memberCount.toString()))
                .setColor(color)
                .setFooter({ text: `Member #${interaction.guild.memberCount}` });

            // Don't set image in preview if it's the {generateImage} placeholder
            // We'll show a message about image generation instead

            // Process the message content
            let messageContent = message
                .replace('{member.mention}', interaction.user.toString())
                .replace('{member.username}', interaction.user.username)
                .replace('{member.id}', interaction.user.id)
                .replace('{guild.name}', interaction.guild.name)
                .replace('{guild.id}', interaction.guild.id)
                .replace('{memberCount}', interaction.guild.memberCount.toString())
                .replace('{generateImage}', '*Image generation would appear here*');

            // Check if guild has a banner or icon for image generation
            const guildBannerURL = interaction.guild.bannerURL();
            const guildIconURL = interaction.guild.iconURL();
            const hasBackground = guildBannerURL || guildIconURL;

            let responseContent = `Welcome system has been set up successfully in ${channel}! Here's a preview of how it will look:\n\n${messageContent}`;

            if (welcomeConfig.imageGeneration) {
                if (hasBackground) {
                    responseContent += '\n\nImage generation is enabled and will use your server background with the user\'s profile picture in a circle.'
                } else {
                    responseContent += '\n\n⚠️ Warning: Image generation is enabled but your server does not have a banner or icon set. The welcome image will not be generated until you set one.';
                }
            }

            return interaction.reply({
                content: responseContent,
                embeds: [embed],
                ephemeral: true
            });
        } catch (error) {
            console.error('Error setting up welcome system:', error);
            return interaction.reply({
                content: 'An error occurred while setting up the welcome system.',
                ephemeral: true
            });
        }
    }

    // Handle template edit modal
    else if (interaction.customId.startsWith('template_edit_')) {
        const channelId = interaction.customId.replace('template_edit_', '');
        const channel = await interaction.guild.channels.fetch(channelId);

        if (!channel) {
            return interaction.reply({
                content: 'Channel not found. Please try again.',
                ephemeral: true
            });
        }

        // Get values from the modal
        const title = interaction.fields.getTextInputValue('template_title');
        const description = interaction.fields.getTextInputValue('template_description');
        const color = interaction.fields.getTextInputValue('template_color');

        try {
            // Create the embed
            const embed = new EmbedBuilder()
                .setTitle(title)
                .setDescription(description)
                .setColor(color);

            // Apply branding color but not the image
            if (global.brandingConfig && global.brandingConfig.embedConfig && global.brandingConfig.embedConfig.color) {
                embed.setColor(global.brandingConfig.embedConfig.color);
            }

            // Apply footer if set (but not timestamp)
            if (global.brandingConfig && global.brandingConfig.embedConfig && global.brandingConfig.embedConfig.footer) {
                embed.setFooter({ text: global.brandingConfig.embedConfig.footer });
            }

            // Create buttons for sending or canceling
            const sendButton = new ButtonBuilder()
                .setCustomId(`template_send_${channelId}`)
                .setLabel('Send Template')
                .setStyle(ButtonStyle.Primary);

            const cancelButton = new ButtonBuilder()
                .setCustomId('template_cancel')
                .setLabel('Cancel')
                .setStyle(ButtonStyle.Secondary);

            const row = new ActionRowBuilder().addComponents(sendButton, cancelButton);

            // Send a preview of the embed
            await interaction.reply({
                content: 'Here\'s a preview of your template embed:',
                embeds: [embed],
                components: [row],
                ephemeral: true
            });

            // Store the template data in memory temporarily
            if (!client.templateData) {
                client.templateData = new Map();
            }

            client.templateData.set(interaction.user.id, {
                title,
                description,
                color,
                channelId
            });

        } catch (error) {
            console.error('Error creating template preview:', error);
            return interaction.reply({
                content: 'An error occurred while creating the template preview.',
                ephemeral: true
            });
        }
    }

    // Handle keyword creation modal
    else if (interaction.customId.startsWith('keyword_create_')) {
        const name = interaction.customId.replace('keyword_create_', '');
        const guildId = interaction.guild.id;

        // Get values from the modal
        const description = interaction.fields.getTextInputValue('keyword_description');
        const color = interaction.fields.getTextInputValue('keyword_color') || '#5865F2';
        const footer = interaction.fields.getTextInputValue('keyword_footer');
        const imageUrl = interaction.fields.getTextInputValue('keyword_image');

        try {
            // Create the keyword in the database
            await Keyword.create({
                guildId,
                name,
                description,
                color,
                footer,
                image: imageUrl
            });

            // Create a preview embed
            const embed = new EmbedBuilder()
                .setTitle(`Keyword: ${name}`)
                .setDescription(description)
                .setColor(color);

            if (footer) embed.setFooter({ text: footer });
            if (imageUrl && imageUrl.trim() !== '') {
                try {
                    // Validate URL format
                    new URL(imageUrl);
                    embed.setImage(imageUrl);
                } catch (error) {
                    console.error('Invalid image URL:', error);
                    // Don't set the image if URL is invalid
                }
            }

            return interaction.reply({
                content: `Keyword "${name}" has been created successfully!`,
                embeds: [embed],
                ephemeral: true
            });
        } catch (error) {
            console.error('Error creating keyword:', error);
            return interaction.reply({
                content: 'An error occurred while creating the keyword.',
                ephemeral: true
            });
        }
    }

    // Handle button link modal
    else if (interaction.customId.startsWith('embed_add_link_')) {
        const messageId = interaction.customId.replace('embed_add_link_', '');

        // Get values from the modal
        const label = interaction.fields.getTextInputValue('button_label');
        const url = interaction.fields.getTextInputValue('button_url');
        const emoji = interaction.fields.getTextInputValue('button_emoji');

        try {
            // Find the embed data
            const embedData = await Embed.findOne({ messageId });

            if (!embedData) {
                return interaction.reply({
                    content: 'Embed data not found. Please try again.',
                    ephemeral: true
                });
            }

            // Add the button to the embed data
            embedData.buttons.push({
                label,
                url,
                emoji
            });

            // Save the updated embed data
            await embedData.save();

            // Create the embed
            const embed = new EmbedBuilder();

            if (embedData.title) embed.setTitle(embedData.title);
            if (embedData.description) embed.setDescription(embedData.description);
            if (embedData.color) {
                try {
                    embed.setColor(embedData.color);
                } catch (error) {
                    console.error('Invalid color format:', error);
                    // Use default Discord blue color
                    embed.setColor('#5865F2');
                }
            }
            if (embedData.footer) embed.setFooter({ text: embedData.footer });
            if (embedData.image && embedData.image.trim() !== '') {
                try {
                    // Validate URL format
                    new URL(embedData.image);
                    embed.setImage(embedData.image);
                } catch (error) {
                    console.error('Invalid image URL:', error);
                    // Don't set the image if URL is invalid
                }
            }

            // Create buttons for the embed
            const buttons = [];

            for (const button of embedData.buttons) {
                const linkButton = new ButtonBuilder()
                    .setLabel(button.label)
                    .setURL(button.url)
                    .setStyle(ButtonStyle.Link);

                if (button.emoji) {
                    linkButton.setEmoji(button.emoji);
                }

                buttons.push(linkButton);
            }

            // Create action rows for the buttons (max 5 buttons per row)
            const buttonRows = [];
            for (let i = 0; i < buttons.length; i += 5) {
                const row = new ActionRowBuilder().addComponents(buttons.slice(i, i + 5));
                buttonRows.push(row);
            }

            // Add control buttons
            const addLinkButton = new ButtonBuilder()
                .setCustomId('embed_add_link')
                .setLabel('Add Link')
                .setStyle(ButtonStyle.Secondary);

            const sendEmbedButton = new ButtonBuilder()
                .setCustomId('embed_send')
                .setLabel('Send Embed')
                .setStyle(ButtonStyle.Primary);

            const controlRow = new ActionRowBuilder().addComponents(addLinkButton, sendEmbedButton);

            // Update the preview message
            await interaction.update({
                content: 'Here\'s a preview of your embed with buttons. You can add more buttons or send it as is.',
                embeds: [embed],
                components: [...buttonRows, controlRow]
            });

            return;
        } catch (error) {
            console.error('Error adding button to embed:', error);
            return interaction.reply({
                content: 'An error occurred while adding the button to the embed.',
                ephemeral: true
            });
        }
    }

    // Handle FiveM Passport verification
    if (interaction.customId.startsWith('passport_verify_')) {
        const guildId = interaction.customId.split('_')[2];

        // Try to get config using the guild ID from the button
        let config = verificationConfig.get(guildId);

        // If not found, try using the current guild ID
        if (!config) {
            config = verificationConfig.get(interaction.guild.id);
        }

        // If still not found, try to load from database
        if (!config) {
            try {
                // Try to find the config in the database
                const dbConfig = await VerificationConfig.findOne({ guildId: interaction.guild.id });

                if (dbConfig) {
                    config = {
                        channelId: dbConfig.channelId,
                        roleId: dbConfig.roleId,
                        type: dbConfig.type,
                        embedConfig: dbConfig.embedConfig
                    };

                    // Store in memory for future use
                    verificationConfig.set(interaction.guild.id, config);
                }
            } catch (error) {
                console.error('Error loading verification config from database:', error);
            }
        }

        if (!config) {
            return interaction.reply({
                content: 'Verification system is not properly configured. Please ask an administrator to set up verification again.',
                ephemeral: true
            });
        }

        // Get the roleplay name from the modal
        const firstName = interaction.fields.getTextInputValue('first_name');
        const lastName = interaction.fields.getTextInputValue('last_name');

        // Format the nickname (e.g., "J. Smith" for "John Smith")
        const formattedNickname = `${firstName.charAt(0)}. ${lastName}`;

        let nicknameChanged = false;
        let responseMessage = '';

        try {
            // Try to set the nickname
            try {
                await interaction.member.setNickname(formattedNickname);
                nicknameChanged = true;
                responseMessage = `Your FiveM Passport has been verified! Your display name has been set to ${formattedNickname}.`;
            } catch (nicknameError) {
                // If nickname change fails, continue with verification but inform the user
                console.error('Failed to set nickname:', nicknameError);
                responseMessage = `Your FiveM Passport has been verified! However, I couldn't set your nickname to ${formattedNickname} due to insufficient permissions. Please ask a server administrator to change it for you.`;
            }

            // Assign the verification role
            const role = await interaction.guild.roles.fetch(config.roleId);
            if (role) {
                await interaction.member.roles.add(role);
            }

            return interaction.reply({
                content: responseMessage,
                ephemeral: true
            });
        } catch (error) {
            console.error('Failed to process FiveM Passport verification:', error);

            // If we managed to change the nickname but role assignment failed
            if (nicknameChanged) {
                return interaction.reply({
                    content: `I set your nickname to ${formattedNickname}, but couldn't assign the verification role. Please contact an administrator.`,
                    ephemeral: true
                });
            } else {
                return interaction.reply({
                    content: 'An error occurred during verification. Please contact an administrator.',
                    ephemeral: true
                });
            }
        }
    }

    // Handle sticky message creation modal
    else if (interaction.customId.startsWith('sticky_create_')) {
        const parts = interaction.customId.split('_');
        const channelId = parts[2];
        const content = interaction.fields.getTextInputValue('sticky_content');
        const guildId = interaction.guild.id;

        // Get optional embed fields
        const embedTitle = interaction.fields.getTextInputValue('embed_title');
        const embedDescription = interaction.fields.getTextInputValue('embed_description');
        const embedImage = interaction.fields.getTextInputValue('embed_image');

        // Use the embed title as the sticky message title, or generate a default if not provided
        const title = embedTitle && embedTitle.trim() !== '' ?
            embedTitle :
            `Sticky Message ${new Date().toLocaleDateString()}`;

        // Check if database is connected
        if (!db.isConnected()) {
            return interaction.reply({
                content: 'This command requires database access, but the database is currently unavailable. Please try again later.',
                ephemeral: true
            });
        }

        try {
            // Send an initial response to prevent timeout - make it ephemeral here
            await interaction.deferReply({ ephemeral: true });

            // Check if a sticky message already exists in this channel
            const existingActiveSticky = await safeDbOperation(
                () => StickyMessage.findOne({ guildId, channelId, active: true }),
                null
            );

            if (existingActiveSticky) {
                return interaction.editReply({
                    content: `There is already an active sticky message in <#${channelId}>. Please pause it before creating a new one.`,
                    ephemeral: true
                });
            }

            // Create the sticky message with embed data
            const stickyMessage = await safeDbOperation(
                async () => {
                    const newSticky = await StickyMessage.create({
                        guildId,
                        channelId,
                        title,
                        content,
                        embedData: {
                            title: embedTitle,
                            description: embedDescription,
                            image: embedImage
                        },
                        active: true,
                        createdBy: interaction.user.id
                    });
                    return newSticky;
                },
                null
            );

            if (!stickyMessage) {
                return interaction.editReply({
                    content: 'Failed to create sticky message due to a database error. Please try again later.',
                    ephemeral: true
                });
            }

            // Get the channel
            const channel = await client.channels.fetch(channelId);

            // Create the sticky message embed
            const embed = new EmbedBuilder()
                .setColor('#5865F2') // Discord Blue
                .setFooter({ text: 'Sticky Message' })
                .setTimestamp();

            // Set title if provided, otherwise use the sticky message title
            if (embedTitle) {
                embed.setTitle(embedTitle);
            } else {
                embed.setTitle(title);
            }

            // Set description if provided, otherwise use the content
            if (embedDescription) {
                embed.setDescription(embedDescription);
            } else {
                embed.setDescription(content);
            }

            // Set image if provided
            if (embedImage && embedImage.trim() !== '') {
                try {
                    // Validate URL format
                    new URL(embedImage);
                    embed.setImage(embedImage);
                } catch (error) {
                    console.error('Invalid image URL for sticky message:', error);
                }
            }

            // Apply branding
            applyBranding(embed);

            // Prepare message content and embed
            const messageOptions = {};

            // Add content if it exists and is different from embed description
            if (content && (!embedDescription || content !== embedDescription)) {
                messageOptions.content = content;
            }

            // Add embed
            messageOptions.embeds = [embed];

            // Send the sticky message
            const message = await channel.send(messageOptions);

            // Update the last message ID
            stickyMessage.lastMessageId = message.id;
            await safeDbOperation(
                () => stickyMessage.save(),
                null
            );

            // Create a success embed
            const successEmbed = new EmbedBuilder()
                .setTitle('Sticky Message Created')
                .setDescription(`A sticky message with the title "${title}" has been created in ${channel}.`)
                .setColor('#57F287') // Green
                .setTimestamp();

            // Apply branding
            applyBranding(successEmbed);

            return interaction.editReply({
                embeds: [successEmbed],
                ephemeral: true
            });
        } catch (error) {
            console.error('Error creating sticky message:', error);
            return interaction.editReply({
                content: 'An error occurred while creating the sticky message.',
                ephemeral: true
            });
        }
    }

    // Handle branding footer modal
    else if (interaction.customId === 'branding_footer_modal') {
        const guildId = interaction.guild.id;
        const footerText = interaction.fields.getTextInputValue('footer_text');

        try {
            // Get existing config or create new one
            let config = await BrandingConfig.findOne({ guildId });

            if (!config) {
                config = new BrandingConfig({
                    guildId,
                    status: {
                        type: 'PLAYING',
                        text: 'with Discord.js'
                    },
                    embedConfig: {
                        color: '#5865F2', // Default Discord blue
                        footer: footerText
                    },
                    updatedBy: interaction.user.id,
                    updatedAt: new Date()
                });
            } else {
                // Update footer field
                config.embedConfig.footer = footerText;
                config.updatedBy = interaction.user.id;
                config.updatedAt = new Date();
            }

            await config.save();

            // Update the global branding config
            global.brandingConfig = config;

            // Create a success embed with the new footer
            let embed = new EmbedBuilder()
                .setTitle('Embed Footer Updated')
                .setDescription('All embeds will now use the new footer text.')
                .setColor(config.embedConfig.color || '#57F287')
                .setFooter({ text: footerText });

            // No timestamp since footer replaces it

            return interaction.reply({
                embeds: [embed],
                ephemeral: true
            });
        } catch (error) {
            console.error('Error updating embed footer:', error);
            return interaction.reply({
                content: 'An error occurred while updating the embed footer.',
                ephemeral: true
            });
        }
    }

    // Handle verification embed configuration
    else if (interaction.customId === 'verification_embed_config') {
        const guildId = interaction.guild.id;
        const config = verificationConfig.get(guildId);

        if (!config) {
            return interaction.reply({
                content: 'Configuration not found. Please set up the Verification Module first.',
                ephemeral: true
            });
        }

        // Get values from the modal
        const title = interaction.fields.getTextInputValue('embed_title');
        const description = interaction.fields.getTextInputValue('embed_description');
        const color = interaction.fields.getTextInputValue('embed_color');
        const footer = interaction.fields.getTextInputValue('embed_footer');

        // Update configuration
        config.embedConfig = {
            title,
            description,
            color,
            footer
        };

        // Update in memory
        verificationConfig.set(guildId, config);

        // Update in database
        try {
            await VerificationConfig.findOneAndUpdate(
                { guildId },
                { embedConfig: config.embedConfig },
                { upsert: true, new: true }
            );
        } catch (error) {
            console.error('Error updating verification embed config:', error);
        }

        // Create a preview embed
        const previewEmbed = new EmbedBuilder()
            .setTitle(title)
            .setDescription(description)
            .setColor(color)
            .setFooter({ text: footer });

        // Update the verification embed in the channel
        try {
            const channel = await client.channels.fetch(config.channelId);
            if (channel) {
                // Fetch the last 50 messages to find the verification embed
                const messages = await channel.messages.fetch({ limit: 50 });
                const botMessages = messages.filter(m => m.author.id === client.user.id && m.components.length > 0);

                if (botMessages.size > 0) {
                    // Get the most recent bot message with components (likely the verification embed)
                    const verificationMessage = botMessages.first();

                    // Keep the same components but update the embed
                    await verificationMessage.edit({ embeds: [previewEmbed], components: verificationMessage.components });
                }
            }
        } catch (error) {
            console.error('Failed to update verification embed:', error);
        }

        return interaction.reply({
            content: 'Verification embed has been updated successfully! Here\'s a preview:',
            embeds: [previewEmbed],
            ephemeral: true
        });
    }

    // Handle vanity roles embed configuration
    else if (interaction.customId === 'vanityroles_embed_config') {
        const guildId = interaction.guild.id;
        const config = vanityRolesConfig.get(guildId);

        if (!config) {
            return interaction.reply({
                content: 'Configuration not found. Please set up the Vanity Roles Module first.',
                ephemeral: true
            });
        }

        // Get values from the modal
        const description = interaction.fields.getTextInputValue('embed_description');
        const color = interaction.fields.getTextInputValue('embed_color');

        // Update configuration
        config.embedConfig = {
            description,
            color
        };

        // Update in memory
        vanityRolesConfig.set(guildId, config);

        // Update in database
        try {
            await VanityRolesConfig.findOneAndUpdate(
                { guildId },
                { $set: { embedConfig: config.embedConfig } },
                { upsert: true }
            );

            // Create a preview embed
            const previewEmbed = new EmbedBuilder()
                .setTitle('Vanity URL Added')
                .setDescription(description
                    .replace('{member}', interaction.user)
                    .replace('{member.mention}', interaction.user)
                    .replace('{member.tag}', interaction.user.username)
                    .replace('{member.id}', interaction.user.id)
                    .replace('{guild.name}', interaction.guild.name)
                    .replace('{guild.id}', interaction.guild.id)
                    .replace('{vanityURL}', config.vanityUrl || 'example'))
                .setColor(color)
                .setTimestamp();

            return interaction.reply({
                content: 'Vanity notification embed has been updated! Here\'s a preview:',
                embeds: [previewEmbed],
                ephemeral: true
            });
        } catch (error) {
            console.error('Error updating vanity embed config:', error);
            return interaction.reply({
                content: 'An error occurred while updating the vanity embed configuration.',
                ephemeral: true
            });
        }
    }

    // Handle restarts embed configuration
    else if (interaction.customId === 'restarts_embed_config') {
        const guildId = interaction.guild.id;
        const config = restartsConfig.get(guildId);

        if (!config) {
            return interaction.reply({
                content: 'Configuration not found. Please set up the Restarts Module first.',
                ephemeral: true
            });
        }

        // Get values from the modal
        const title = interaction.fields.getTextInputValue('embed_title');
        const description = interaction.fields.getTextInputValue('embed_description');
        const color = interaction.fields.getTextInputValue('embed_color');
        const options = interaction.fields.getTextInputValue('embed_options');

        // Parse options
        const showTimestamp = options.toLowerCase().includes('timestamp: yes');
        const showServerIp = options.toLowerCase().includes('server ip: yes');

        // Update configuration
        config.embedConfig = {
            title,
            description,
            color,
            showTimestamp,
            showServerIp
        };

        restartsConfig.set(guildId, config);

        // Save to database if connected
        try {
            if (db.isConnected()) {
                await RestartsConfig.findOneAndUpdate(
                    { guildId },
                    config,
                    { upsert: true, new: true }
                );
            }
        } catch (error) {
            console.error('Error saving restarts embed config to database:', error);
            // Continue anyway - config is saved in memory
        }

        // Create a preview embed
        const previewEmbed = new EmbedBuilder()
            .setTitle(title)
            .setDescription(description)
            .setColor(color);

        if (showTimestamp) {
            previewEmbed.setTimestamp();
        }

        if (showServerIp) {
            previewEmbed.addFields({ name: 'Connect to Server', value: config.serverIp });
        }

        return interaction.reply({
            content: 'Embed configuration updated successfully! Here\'s a preview:',
            embeds: [previewEmbed],
            ephemeral: true
        });
    }

    // Handle multi-step application submissions
    else if (interaction.customId.startsWith('application_step_')) {
        const parts = interaction.customId.split('_');
        const panelName = parts[2];
        const currentStep = parseInt(parts[3]);
        const panel = applicationPanels.get(panelName);

        if (!panel) {
            return interaction.reply({
                content: `<@${interaction.user.id}> This application panel no longer exists. Please contact a server administrator.`,
                ephemeral: true
            });
        }

        // Get the user's application progress
        if (!client.applicationSteps) {
            client.applicationSteps = new Map();
        }

        let userProgress = client.applicationSteps.get(interaction.user.id);
        if (!userProgress) {
            return interaction.reply({
                content: `<@${interaction.user.id}> Your application session has expired. Please start again by clicking the Apply button.`,
                ephemeral: true
            });
        }

        // Calculate which questions were in this step
        const startIndex = (currentStep - 1) * 5;
        const endIndex = Math.min(startIndex + 5, panel.questions.length);
        const questionsForThisStep = panel.questions.slice(startIndex, endIndex);

        // Collect answers from this step
        questionsForThisStep.forEach(question => {
            userProgress.answers[question.id] = {
                question: question.label,
                answer: interaction.fields.getTextInputValue(question.id)
            };
        });

        // Update the user's progress
        userProgress.currentStep++;
        client.applicationSteps.set(interaction.user.id, userProgress);

        // Check if there are more steps
        if (userProgress.currentStep <= userProgress.totalSteps) {
            // Calculate which questions are in the next step
            const nextStartIndex = (userProgress.currentStep - 1) * 5;
            const nextEndIndex = Math.min(nextStartIndex + 5, panel.questions.length);
            const questionsForNextStep = panel.questions.slice(nextStartIndex, nextEndIndex);

            // Create modal for the next step
            const modal = new ModalBuilder()
                .setCustomId(`application_step_${panelName}_${userProgress.currentStep}`)
                .setTitle(`${panel.title} (Step ${userProgress.currentStep}/${userProgress.totalSteps})`);

            // Add questions for the next step
            questionsForNextStep.forEach(question => {
                const input = new TextInputBuilder()
                    .setCustomId(question.id)
                    .setLabel(question.label)
                    .setStyle(question.style)
                    .setRequired(true);

                modal.addComponents(new ActionRowBuilder().addComponents(input));
            });

            // Create a button for the user to continue to the next step
            const continueButton = new ButtonBuilder()
                .setCustomId(`continue_application_${panelName}_${userProgress.currentStep}`)
                .setLabel(`Continue to Step ${userProgress.currentStep}`)
                .setStyle(ButtonStyle.Primary);

            const row = new ActionRowBuilder().addComponents(continueButton);

            await interaction.reply({
                content: `<@${interaction.user.id}> Step ${currentStep} completed. Please click the button below to continue to Step ${userProgress.currentStep} of your ${panel.title} application.`,
                components: [row],
                ephemeral: true
            });

            return;
        } else {
            // All steps completed, process the full application
            // Convert the answers object to an array format expected by the rest of the code
            const answers = Object.values(userProgress.answers);

            // Generate a unique ID for this response
            const responseId = `${interaction.user.id}-${Date.now()}`;

            // Store the response in memory
            applicationResponses.set(responseId, {
                responseId,
                userId: interaction.user.id,
                panelName,
                answers,
                status: 'pending',
                timestamp: new Date()
            });

            // Store the response in database
            const applicationResponse = new ApplicationResponse({
                guildId: interaction.guild.id,
                responseId,
                userId: interaction.user.id,
                panelName,
                answers,
                status: 'pending'
            });
            await applicationResponse.save();

            // Send the response to the logs channel
            const logsChannel = await interaction.guild.channels.fetch(panel.logsChannelId);
            if (logsChannel) {
                // Create an embed for the application response
                const embed = new EmbedBuilder()
                    .setTitle(`New Application Response - ${panel.title}`)
                    .setDescription(`Submitted by: <@${interaction.user.id}>`)
                    .setColor('#5865F2')
                    .setTimestamp()
                    .setFooter({ text: `Response ID: ${responseId}` });

                // Add fields for each answer
                answers.forEach(answer => {
                    embed.addFields({
                        name: answer.question,
                        value: `\`${answer.answer || 'No response provided'}\``,
                        inline: true
                    });
                });

                // Create action buttons
                const viewButton = new ButtonBuilder()
                    .setCustomId(`view_${responseId}`)
                    .setLabel('View Application Response')
                    .setStyle(ButtonStyle.Secondary);

                const acceptButton = new ButtonBuilder()
                    .setCustomId(`accept_${responseId}`)
                    .setLabel('Accept')
                    .setStyle(ButtonStyle.Success);

                const denyButton = new ButtonBuilder()
                    .setCustomId(`deny_${responseId}`)
                    .setLabel('Deny')
                    .setStyle(ButtonStyle.Danger);

                const row = new ActionRowBuilder()
                    .addComponents(viewButton, acceptButton, denyButton);

                await logsChannel.send({ embeds: [embed], components: [row] });
            }

            // Clean up the application progress
            client.applicationSteps.delete(interaction.user.id);

            // Create a success embed
            const successEmbed = new EmbedBuilder()
                .setTitle(`\`✅\` ${panel.title} Application submitted!`)
                .setDescription(`Thank you for your application for this position, it has been received with gratitude. Please remain patient while our team review your response appropriately. Please refrain from messaging our team regarding to your application, as it may lead to rejection.\n\n**Important:** You must keep your Direct Messages open for us to send the outcome to your direct-messages!`)
                .setColor('#57F287') // Green color
                .setTimestamp();

            return interaction.reply({
                embeds: [successEmbed],
                ephemeral: true
            });
        }
    }

    // Handle single-step application submissions
    else if (interaction.customId.startsWith('application_')) {
        const panelName = interaction.customId.replace('application_', '');
        const panel = applicationPanels.get(panelName);

        if (!panel) {
            return interaction.reply({
                content: 'This application panel no longer exists.',
                ephemeral: true
            });
        }

        // Collect the answers
        const answers = [];
        panel.questions.forEach(question => {
            answers.push({
                question: question.label,
                answer: interaction.fields.getTextInputValue(question.id)
            });
        });

        // Generate a unique ID for this response
        const responseId = `${Date.now()}_${interaction.user.id}`;

        // Store the response
        applicationResponses.set(responseId, {
            panelName,
            userId: interaction.user.id,
            answers,
            timestamp: new Date(),
            status: 'pending'
        });

        // Send the response to the logs channel
        const logsChannel = await client.channels.fetch(panel.logsChannelId);

        if (logsChannel) {
            const embed = new EmbedBuilder()
                .setTitle(`New Application: ${panel.title}`)
                .setDescription(`From: <@${interaction.user.id}>`)
                .setColor('#5865F2')
                .setTimestamp()
                .setFooter({ text: `Response ID: ${responseId}` });

            // Add a preview of the first few questions/answers
            const previewAnswers = answers.slice(0, 2);
            previewAnswers.forEach(answer => {
                embed.addFields({
                    name: answer.question,
                    value: `\`${answer.answer.length > 100
                        ? answer.answer.substring(0, 97) + '...'
                        : answer.answer}\``,
                    inline: true
                });
            });

            if (answers.length > 2) {
                embed.addFields({
                    name: 'Additional Responses',
                    value: `This application has ${answers.length - 2} more responses. Click the button below to view the full application.`
                });
            }

            // Create action buttons
            const viewButton = new ButtonBuilder()
                .setCustomId(`view_${responseId}`)
                .setLabel('View Application Response')
                .setStyle(ButtonStyle.Secondary);

            const acceptButton = new ButtonBuilder()
                .setCustomId(`accept_${responseId}`)
                .setLabel('Accept')
                .setStyle(ButtonStyle.Success);

            const denyButton = new ButtonBuilder()
                .setCustomId(`deny_${responseId}`)
                .setLabel('Deny')
                .setStyle(ButtonStyle.Danger);

            const row = new ActionRowBuilder()
                .addComponents(viewButton, acceptButton, denyButton);

            await logsChannel.send({ embeds: [embed], components: [row] });
        }

        // Create a success embed
        const successEmbed = new EmbedBuilder()
            .setTitle(`\`✅\` ${panel.title} Application submitted!`)
            .setDescription(`Thank you for your application for this position, it has been received with gratitude. Please remain patient while our team review your response appropriately. Please refrain from messaging our team regarding to your application, as it may lead to rejection.\n\n**Important:** You must keep your Direct Messages open for us to send the outcome to your direct-messages!`)
            .setColor('#57F287') // Green color
            .setTimestamp();

        return interaction.reply({
            embeds: [successEmbed],
            ephemeral: true
        });
    }

    // Handle accept/deny reason modals
    else if (interaction.customId.startsWith('acceptreason_') || interaction.customId.startsWith('denyreason_')) {
        const isAccept = interaction.customId.startsWith('acceptreason_');
        const responseId = interaction.customId.replace(isAccept ? 'acceptreason_' : 'denyreason_', '');
        const reason = interaction.fields.getTextInputValue('reason');

        const response = applicationResponses.get(responseId);
        if (!response) {
            return interaction.reply({
                content: 'This application response no longer exists.',
                ephemeral: true
            });
        }

        // Update the response status
        response.status = isAccept ? 'accepted' : 'denied';
        response.decision = {
            by: interaction.user.id,
            reason,
            timestamp: new Date()
        };

        applicationResponses.set(responseId, response);

        // Update the application response in the database
        try {
            await ApplicationResponse.findOneAndUpdate(
                { responseId },
                {
                    status: response.status,
                    decision: response.decision
                }
            );
        } catch (error) {
            console.error('Failed to update application response in database:', error);
        }

        // Get the panel data
        const panel = applicationPanels.get(response.panelName);

        // Notify the applicant via DM
        try {
            const applicant = await client.users.fetch(response.userId);
            const dmEmbed = new EmbedBuilder()
                .setTitle(`Application ${isAccept ? 'Accepted' : 'Denied'}: ${panel.title}`)
                .setDescription(`Your application has been ${isAccept ? 'accepted' : 'denied'}.`)
                .addFields({ name: 'Reason', value: reason })
                .setColor(isAccept ? '#57F287' : '#ED4245')
                .setTimestamp();

            await applicant.send({ embeds: [dmEmbed] });
        } catch (error) {
            console.error('Failed to send DM to applicant:', error);
        }

        // If there's a results channel, post the result there
        if (panel.resultsChannelId) {
            try {
                const resultsChannel = await client.channels.fetch(panel.resultsChannelId);
                const resultEmbed = new EmbedBuilder()
                    .setTitle(`Application ${isAccept ? 'Accepted' : 'Denied'}: ${panel.title}`)
                    .setDescription(`Applicant: <@${response.userId}>`)
                    .addFields({ name: 'Reason', value: reason })
                    .setColor(isAccept ? '#57F287' : '#ED4245')
                    .setFooter({ text: `Decision by: ${interaction.user.tag}` })
                    .setTimestamp();

                await resultsChannel.send({ embeds: [resultEmbed] });
            } catch (error) {
                console.error('Failed to send to results channel:', error);
            }
        }

        // If accepted and there's a role to assign, add it to the user
        if (isAccept && panel.roleId) {
            try {
                const guild = interaction.guild;
                const member = await guild.members.fetch(response.userId);
                const role = await guild.roles.fetch(panel.roleId);

                if (role && member) {
                    await member.roles.add(role);
                }
            } catch (error) {
                console.error('Failed to assign role:', error);
            }
        }

        // Update the original message to replace accept/deny buttons with status button
        try {
            // Find the message that contains the application response
            const channel = await client.channels.fetch(panel.logsChannelId);
            if (channel) {
                const messages = await channel.messages.fetch({ limit: 100 });
                const applicationMessage = messages.find(msg =>
                    msg.components.length > 0 &&
                    msg.components[0].components.some(component =>
                        component.customId === `accept_${responseId}` ||
                        component.customId === `deny_${responseId}`
                    )
                );

                if (applicationMessage) {
                    // Create a new button showing who accepted/denied
                    const statusButton = new ButtonBuilder()
                        .setCustomId(`status_${responseId}`)
                        .setLabel(`@${interaction.user.username} ${isAccept ? 'Accepted' : 'Denied'}`)
                        .setStyle(isAccept ? ButtonStyle.Success : ButtonStyle.Danger)
                        .setDisabled(true);

                    // Keep only the view button
                    const viewButton = new ButtonBuilder()
                        .setCustomId(`view_${responseId}`)
                        .setLabel('View Application Response')
                        .setStyle(ButtonStyle.Secondary);

                    const row = new ActionRowBuilder()
                        .addComponents(viewButton, statusButton);

                    await applicationMessage.edit({ components: [row] });
                }
            }
        } catch (error) {
            console.error('Failed to update application message:', error);
        }

        return interaction.reply({
            content: `Application ${isAccept ? 'accepted' : 'denied'} successfully.`,
            ephemeral: true
        });
    }
});

// Poll FiveM servers for restart detection
async function checkServerRestarts() {
    for (const [guildId, config] of restartsConfig.entries()) {
        try {
            // Fetch server info to get the actual server endpoint
            const infoResponse = await fetch(`https://servers-frontend.fivem.net/api/servers/single/${config.cfxCode}`);

            if (!infoResponse.ok) {
                if (config.debug) console.log(`[Restarts] Failed to fetch server info for guild ${guildId}`);
                continue;
            }

            const infoData = await infoResponse.json();
            const serverEndpoint = infoData.Data?.connectEndPoints?.[0];

            if (!serverEndpoint) {
                if (config.debug) console.log(`[Restarts] No server endpoint found for guild ${guildId}`);
                continue;
            }

            // Query the server directly for real-time player data
            let currentPlayers = 0;
            let isOnline = false;

            try {
                const playersResponse = await fetch(`http://${serverEndpoint}/players.json`, {
                    signal: AbortSignal.timeout(3000)
                });

                if (playersResponse.ok) {
                    const players = await playersResponse.json();
                    currentPlayers = Array.isArray(players) ? players.length : 0;
                    isOnline = true;
                }
            } catch (err) {
                // Server is offline or unreachable
                isOnline = false;
                currentPlayers = 0;
            }

            if (config.debug) console.log(`[Restarts] Guild ${guildId}: Online: ${isOnline}, Players: ${currentPlayers}, WasOnline: ${config.wasOnline}, RestartFlag: ${config.restartDetected || false}`);

            // Initialize on first run
            if (config.wasOnline === null || config.wasOnline === undefined) {
                config.wasOnline = isOnline;
                config.lastPlayerCount = currentPlayers;
                restartsConfig.set(guildId, config);

                if (db.isConnected()) {
                    await RestartsConfig.findOneAndUpdate(
                        { guildId },
                        { lastPlayerCount: currentPlayers },
                        { upsert: false }
                    );
                }

                if (config.debug) console.log(`[Restarts] ✅ Initialized tracking for guild ${guildId} - Server is ${isOnline ? 'ONLINE' : 'OFFLINE'}`);
                continue;
            }

            // Detect server going offline
            if (config.wasOnline && !isOnline) {
                if (config.debug) console.log(`[Restarts] 🔴 Server went OFFLINE for guild ${guildId}`);
                config.wasOnline = false;
                restartsConfig.set(guildId, config);
            }
            // Detect server coming back online - ALWAYS send notification
            else if (!config.wasOnline && isOnline) {
                if (config.debug) console.log(`[Restarts] 🟢 Server came back ONLINE for guild ${guildId} - Sending notification...`);

                try {
                    const channel = await client.channels.fetch(config.channelId);

                    if (channel) {
                        const embed = new EmbedBuilder()
                            .setTitle('🔄 Server Restarted')
                            .setDescription('The server has been restarted and is now online!')
                            .setColor('#57F287')
                            .setTimestamp();

                        const connectButton = new ButtonBuilder()
                            .setLabel('Connect')
                            .setURL(`https://${config.connectLink}`)
                            .setStyle(ButtonStyle.Link);

                        const row = new ActionRowBuilder().addComponents(connectButton);

                        await channel.send({
                            content: `<@&${config.roleId}>`,
                            embeds: [embed],
                            components: [row]
                        });

                        if (config.debug) console.log(`[Restarts] ✅ Sent restart notification for guild ${guildId}`);
                    }
                } catch (err) {
                    if (config.debug) console.error(`[Restarts] Failed to send notification for guild ${guildId}:`, err.message);
                }

                config.wasOnline = true;
                restartsConfig.set(guildId, config);
            }

            // Update player count
            config.lastPlayerCount = currentPlayers;
            restartsConfig.set(guildId, config);

            if (db.isConnected()) {
                await RestartsConfig.findOneAndUpdate(
                    { guildId },
                    { lastPlayerCount: currentPlayers },
                    { upsert: false }
                );
            }
        } catch (error) {
            if (config.debug) console.error(`[Restarts] Error checking server for guild ${guildId}:`, error.message);
        }
    }
}

// Update FiveM status displays with real-time data
async function updateFiveMStatus() {
    for (const [guildId, config] of fivemStatusConfig.entries()) {
        try {
            // Get server info first
            const infoResponse = await fetch(`https://servers-frontend.fivem.net/api/servers/single/${config.cfxCode}`);
            if (!infoResponse.ok) continue;

            const infoData = await infoResponse.json();
            if (!infoData.Data) continue;

            const serverData = infoData.Data;
            const hostname = serverData.hostname || 'Unknown Server';
            const maxPlayers = serverData.sv_maxclients || 200;
            const connectLink = `cfx.re/join/${config.cfxCode}`;
            const serverEndpoint = serverData.connectEndPoints?.[0];

            // Query server directly for real-time player count
            let currentPlayers = 0;
            let isOnline = false;

            if (serverEndpoint) {
                try {
                    const playersResponse = await fetch(`http://${serverEndpoint}/players.json`, {
                        signal: AbortSignal.timeout(3000)
                    });

                    if (playersResponse.ok) {
                        const players = await playersResponse.json();
                        currentPlayers = Array.isArray(players) ? players.length : 0;
                        isOnline = true;
                    }
                } catch (err) {
                    // Server is offline
                    isOnline = false;
                }
            }

            // Get guild icon
            const guild = await client.guilds.fetch(guildId);
            const guildIcon = guild.iconURL({ dynamic: true, size: 1024 });

            const statusEmbed = new EmbedBuilder()
                .setTitle('📊 Server Statistics')
                .addFields(
                    { name: 'Server Status', value: isOnline ? '🟢 Online' : '🔴 Offline', inline: true },
                    { name: 'FiveM Status', value: isOnline ? '🟢 Operational' : '🔴 Down', inline: true },
                    { name: 'Player Count', value: isOnline ? `[${currentPlayers}/${maxPlayers}]` : '[0/0]', inline: true },
                    { name: 'Refreshed', value: '<t:' + Math.floor(Date.now() / 1000) + ':R>', inline: true }
                )
                .setColor(isOnline ? '#5865F2' : '#ED4245')
                .setFooter({ text: `${hostname}` });

            // Add guild icon as image if available
            if (guildIcon) {
                statusEmbed.setImage(guildIcon);
            }

            const connectButton = new ButtonBuilder()
                .setLabel('Connect')
                .setURL(`https://${connectLink}`)
                .setStyle(ButtonStyle.Link);

            const row = new ActionRowBuilder().addComponents(connectButton);

            // Update the message
            const channel = await client.channels.fetch(config.channelId);
            if (channel && config.messageId) {
                const message = await channel.messages.fetch(config.messageId);
                if (message) {
                    await message.edit({
                        embeds: [statusEmbed],
                        components: [row]
                    });
                }
            }
        } catch (error) {
            if (config.debug) console.error(`[FiveMStatus] Error updating status for guild ${guildId}:`, error.message);
        }
    }
}

// Start polling when bot is ready - check every 10 seconds for near real-time tracking
setInterval(() => {
    checkServerRestarts().catch(console.error);
}, 10000); // Check every 10 seconds

setInterval(() => {
    updateFiveMStatus().catch(console.error);
}, 10000); // Update FiveM status every 10 seconds

// Function to initialize the feedback wall with staff ratings
async function initializeFeedbackWall(guild) {
    const config = feedbackConfig.get(guild.id);
    if (!config) return;

    const feedbackWallChannel = await guild.channels.fetch(config.feedbackWallId);
    if (!feedbackWallChannel) return;

    // Get all staff members with the staff role
    const staffRole = await guild.roles.fetch(config.staffRoleId);
    if (!staffRole) return;

    const staffMembers = staffRole.members;

    // Create and send feedback embeds for each staff member
    for (const [memberId, member] of staffMembers) {
        const feedback = staffFeedback.get(memberId) || { upvotes: [], downvotes: [] };

        const embed = new EmbedBuilder()
            .setTitle(`Feedback for ${member.displayName}`)
            .setColor('#5865F2')
            .addFields(
                { name: '👍 Upvotes', value: `${feedback.upvotes.length}`, inline: true },
                { name: '👎 Downvotes', value: `${feedback.downvotes.length}`, inline: true }
            )
            .setTimestamp();

        await feedbackWallChannel.send({ embeds: [embed] });
    }
}

// Function to update the feedback wall (legacy - kept for reference)
async function updateFeedbackWall(guild) {
    // This function is no longer used but kept for reference
    console.log('Legacy updateFeedbackWall function called');
    return;
}

// Handle presence updates for vanity URL detection and status blacklist
client.on('presenceUpdate', async (_, newPresence) => {
    if (!newPresence || !newPresence.guild) return;

    const guildId = newPresence.guild.id;
    const member = newPresence.member;
    if (!member || member.user.bot) return;

    // Check for status blacklist
    try {
        // Get all blacklisted keywords for this guild
        const blacklists = await StatusBlacklist.find({ guildId });

        if (blacklists.length > 0) {
            // Get the user's status
            const activities = newPresence.activities || [];
            const customStatus = activities.find(activity => activity.type === 4); // Custom status type

            if (customStatus && customStatus.state) {
                const userStatus = customStatus.state.toLowerCase();

                // Check each blacklisted keyword
                for (const blacklist of blacklists) {
                    const keyword = blacklist.keyword.toLowerCase();

                    // Check if the status contains the blacklisted keyword
                    // Also check common variations (e.g., discord.gg/xyz, .gg/xyz, etc.)
                    const containsKeyword = userStatus.includes(keyword) ||
                        (keyword.includes('discord.gg/') && userStatus.includes(keyword.replace('discord.gg/', '.gg/'))) ||
                        (keyword.includes('.gg/') && userStatus.includes(keyword.replace('.gg/', 'discord.gg/')));

                    if (containsKeyword) {
                        // Take action based on the blacklist configuration
                        switch (blacklist.action) {
                            case 'ban':
                                // Check if the member can be banned
                                if (member.bannable) {
                                    try {
                                        await member.ban({
                                            reason: `Status contains blacklisted keyword: ${blacklist.keyword}`
                                        });

                                        console.log(`Banned ${member.user.tag} for having blacklisted keyword in status: ${blacklist.keyword}`);
                                    } catch (error) {
                                        console.error(`Error banning ${member.user.tag}:`, error);
                                    }
                                }
                                break;

                            case 'kick':
                                // Check if the member can be kicked
                                if (member.kickable) {
                                    try {
                                        await member.kick(`Status contains blacklisted keyword: ${blacklist.keyword}`);

                                        console.log(`Kicked ${member.user.tag} for having blacklisted keyword in status: ${blacklist.keyword}`);
                                    } catch (error) {
                                        console.error(`Error kicking ${member.user.tag}:`, error);
                                    }
                                }
                                break;

                            case 'role':
                                // Check if a role ID is specified
                                if (blacklist.roleId) {
                                    try {
                                        const role = await member.guild.roles.fetch(blacklist.roleId);
                                        if (role && !member.roles.cache.has(role.id)) {
                                            await member.roles.add(role, `Status contains blacklisted keyword: ${blacklist.keyword}`);

                                            console.log(`Added role ${role.name} to ${member.user.tag} for having blacklisted keyword in status: ${blacklist.keyword}`);
                                        }
                                    } catch (error) {
                                        console.error(`Error adding role to ${member.user.tag}:`, error);
                                    }
                                }
                                break;
                        }

                        // Log the action to a system channel if available
                        try {
                            const systemChannel = member.guild.systemChannel;
                            if (systemChannel) {
                                const embed = new EmbedBuilder()
                                    .setTitle('Status Blacklist Action')
                                    .setDescription(`Action taken against ${member.user.tag} for having a blacklisted keyword in their status.`)
                                    .addFields(
                                        { name: 'User', value: member.toString(), inline: true },
                                        { name: 'Keyword', value: blacklist.keyword, inline: true },
                                        { name: 'Action', value: blacklist.action.charAt(0).toUpperCase() + blacklist.action.slice(1), inline: true },
                                        { name: 'Status', value: customStatus.state }
                                    )
                                    .setColor('#FF0000') // Red
                                    .setTimestamp();

                                await systemChannel.send({ embeds: [embed] });
                            }
                        } catch (error) {
                            console.error('Error sending status blacklist log:', error);
                        }

                        // Only take action for the first matching blacklist
                        break;
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error checking status blacklist:', error);
    }

    // Check for vanity roles
    const config = vanityRolesConfig.get(guildId);

    // Check if vanity roles are configured for this guild
    if (!config || !config.vanityUrl || !config.roleId) return;

    // Get the vanity role
    const vanityRole = await newPresence.guild.roles.fetch(config.roleId).catch(() => null);
    if (!vanityRole) return;

    // Check if the user has a custom status with the vanity URL
    const hasVanityUrl = newPresence.activities.some(activity => {
        if (activity.type === 4) { // Custom Status
            const state = activity.state?.toLowerCase() || '';
            if (!state) return false;

            // Normalize the vanity URL (remove any prefixes)
            let vanityUrl = config.vanityUrl.toLowerCase();
            const normalizedVanityUrl = vanityUrl.replace(/^(https?:\/\/)?(discord\.gg\/|discord\.com\/invite\/)?/i, '');

            // Check for direct match with the normalized URL
            if (state.includes(normalizedVanityUrl)) {
                return true;
            }

            // Check for various URL formats
            const urlPatterns = [
                `discord.gg/${normalizedVanityUrl}`,
                `.gg/${normalizedVanityUrl}`,
                `discord.com/invite/${normalizedVanityUrl}`,
                `discordapp.com/invite/${normalizedVanityUrl}`
            ];

            for (const pattern of urlPatterns) {
                if (state.includes(pattern)) {
                    return true;
                }
            }

            return false;
        }
        return false;
    });

    // Check if the user already has the role
    const hasRole = member.roles.cache.has(config.roleId);

    if (hasVanityUrl && !hasRole) {
        try {
            // Add the role
            await member.roles.add(vanityRole);

            // Send notification based on configuration
            await sendVanityNotification(newPresence.guild, member, config);
        } catch (error) {
            console.error('Failed to add vanity role:', error.message);
            // If this is a permissions error, log it but don't crash the bot
            if (error.code === 50013) {
                console.warn('Missing permissions to add roles. Please check the bot\'s role hierarchy.');
            }
        }
    } else if (!hasVanityUrl && hasRole) {
        // Remove the role if they no longer have the vanity URL
        try {
            await member.roles.remove(vanityRole);
        } catch (error) {
            console.error('Failed to remove vanity role:', error.message);
            // If this is a permissions error, log it but don't crash the bot
            if (error.code === 50013) {
                console.warn('Missing permissions to remove roles. Please check the bot\'s role hierarchy.');
            }
        }
    }
});

// Function to send vanity role notifications
async function sendVanityNotification(guild, member, config) {
    try {
        // Create the notification embed
        const embed = new EmbedBuilder()
            .setTitle('Vanity URL Added')
            .setDescription(config.embedConfig.description
                .replace('{member}', member)
                .replace('{member.mention}', member)
                .replace('{member.tag}', member.user.username)
                .replace('{member.id}', member.user.id)
                .replace('{guild.name}', guild.name)
                .replace('{guild.id}', guild.id)
                .replace('{vanityURL}', config.vanityUrl))
            .setColor(config.embedConfig.color || '#5865F2')
            .setTimestamp();

        // Apply branding if available
        if (typeof applyBranding === 'function') {
            applyBranding(embed);
        }

        // Send to channel if configured
        if (config.notificationType === 'channel' || config.notificationType === 'both') {
            try {
                const channel = await guild.channels.fetch(config.channelId).catch(() => null);
                if (channel) {
                    await channel.send({ embeds: [embed] });
                } else {
                    console.warn(`Could not find channel ${config.channelId} for vanity notification`);
                }
            } catch (error) {
                console.error('Failed to send vanity notification to channel:', error.message);
            }
        }

        // Send DM if configured
        if (config.notificationType === 'dm' || config.notificationType === 'both') {
            try {
                await member.send({
                    content: `Thank you for adding our vanity URL to your status in ${guild.name}!`,
                    embeds: [embed]
                });
            } catch (error) {
                console.error('Failed to send vanity notification DM:', error.message);
            }
        }
    } catch (error) {
        console.error('Error in sendVanityNotification:', error.message);
    }
}

// Handle guild member boost events
client.on('guildMemberUpdate', async (oldMember, newMember) => {
    // Check if the member has started boosting
    const wasBooster = oldMember.premiumSince;
    const isBooster = newMember.premiumSince;

    if (!wasBooster && isBooster) {
        // Member just started boosting
        const guildId = newMember.guild.id;
        const config = boosterConfig.get(guildId);

        // If no configuration exists or it's disabled, do nothing
        if (!config || !config.enabled) return;

        try {
            // Get the user mention
            const userMention = newMember.toString();

            // Create the embed
            const embed = new EmbedBuilder()
                .setTitle('Server Boost')
                .setDescription('Thanks for boosting the server, Enjoy your booster perks')
                .setColor('#FF73FA') // Discord Nitro pink color
                .setTimestamp();

            // Don't apply branding image, but set a custom footer with boost count
            const boostCount = newMember.guild.premiumSubscriptionCount;
            embed.setFooter({ text: `We now have ${boostCount} Boosts!` });

            // Find the system channel or default channel
            const channel = newMember.guild.systemChannel ||
                (await newMember.guild.channels.fetch()).find(ch =>
                    ch.type === ChannelType.GuildText &&
                    ch.permissionsFor(newMember.guild.members.me).has(PermissionsBitField.Flags.SendMessages)
                );

            if (channel) {
                // Send the message with the mention above the embed
                await channel.send({
                    content: userMention,
                    embeds: [embed]
                });
            }
        } catch (error) {
            console.error('Error sending booster message:', error);
        }
    }
});

// Handle guild member join events for welcome messages and auto roles
client.on('guildMemberAdd', async member => {
    const guildId = member.guild.id;

    try {
        // Check if autoroles module is enabled
        const guildModuleConfig = moduleConfig.get(guildId);
        const autorolesDisabled = guildModuleConfig && guildModuleConfig.disabledModules && guildModuleConfig.disabledModules.includes('autoroles');

        // Assign auto roles only if module is enabled
        if (!autorolesDisabled) {
            const autoRoles = await AutoRole.find({ guildId });

            if (autoRoles.length > 0) {
                for (const autoRole of autoRoles) {
                    try {
                        const role = await member.guild.roles.fetch(autoRole.roleId).catch(() => null);

                        if (role && !member.roles.cache.has(role.id)) {
                            await member.roles.add(role, 'Auto role assignment');
                            console.log(`Assigned auto role ${role.name} to ${member.user.tag}`);
                        }
                    } catch (error) {
                        console.error(`Error assigning auto role to ${member.user.tag}:`, error);
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error processing auto roles:', error);
    }

    // Send custom DM welcome message with buttons
    try {
        // Create the welcome embed
        const dmEmbed = new EmbedBuilder()
            .setTitle(`Welcome to **${member.guild.name}**!`)
            .setDescription(`Hey ${member.toString()}, thanks for joining our server! We're excited to have you here.\n\nMake sure to check out our rules and channels to get started. If you have any questions, feel free to ask in our help channels.`)
            .setColor('#5865F2')
            .setFooter({ text: `Member #${member.guild.memberCount}` })
            .setTimestamp();

        // Apply branding (including banner if set)
        applyBranding(dmEmbed);

        // Create buttons for the welcome message - just Website and Connect
        const websiteButton = new ButtonBuilder()
            .setLabel('Website')
            .setStyle(ButtonStyle.Link)
            .setURL('https://hoodville.tebex.io/'); // Replace with your actual website URL

        const connectButton = new ButtonBuilder()
            .setLabel('Connect to Server')
            .setStyle(ButtonStyle.Link)
            .setURL('https://cfx.re/join/q6o4q4'); // FiveM connection URL

        // Add buttons to an action row
        const row = new ActionRowBuilder()
            .addComponents(websiteButton, connectButton);

        // First mention the user, then send the embed with buttons
        await member.send(`<@${member.id}>`).catch(error => {
            console.error(`Could not send DM mention to ${member.user.tag}:`, error);
        });

        // Send the welcome DM with the embed and buttons
        await member.send({
            embeds: [dmEmbed],
            components: [row]
        }).catch(error => {
            console.error(`Could not send DM to ${member.user.tag}:`, error);
            // Don't throw an error if DM fails - some users have DMs closed
        });

       // console.log(`Sent welcome DM to ${member.user.tag}`);
    } catch (error) {
        console.error(`Error sending welcome DM to ${member.user.tag}:`, error);
        // Continue with server welcome message even if DM fails
    }

    // Check if welcome system is configured for this guild
    const welcomeConfig = await Welcome.findOne({ guildId });

    if (!welcomeConfig || !welcomeConfig.enabled) return;

    try {
        // Get the welcome channel
        const channel = await member.guild.channels.fetch(welcomeConfig.channelId).catch(() => null);

        if (!channel) return;

        // Process the welcome message
        let messageContent = welcomeConfig.message
            .replace('{member.mention}', member.toString())
            .replace('{member.username}', member.user.username)
            .replace('{member.id}', member.id)
            .replace('{guild.name}', member.guild.name)
            .replace('{guild.id}', member.guild.id)
            .replace('{memberCount}', member.guild.memberCount.toString());

        // Create the welcome embed if enabled
        const embeds = [];
        if (welcomeConfig.embedEnabled) {
            const embed = new EmbedBuilder();

            if (welcomeConfig.embedConfig.title) {
                embed.setTitle(welcomeConfig.embedConfig.title
                    .replace('{member.mention}', member.toString())
                    .replace('{member.username}', member.user.username)
                    .replace('{member.id}', member.id)
                    .replace('{guild.name}', member.guild.name)
                    .replace('{guild.id}', member.guild.id)
                    .replace('{memberCount}', member.guild.memberCount.toString()));
            }

            if (welcomeConfig.embedConfig.description) {
                embed.setDescription(welcomeConfig.embedConfig.description
                    .replace('{member.mention}', member.toString())
                    .replace('{member.username}', member.user.username)
                    .replace('{member.id}', member.id)
                    .replace('{guild.name}', member.guild.name)
                    .replace('{guild.id}', member.guild.id)
                    .replace('{memberCount}', member.guild.memberCount.toString()));
            }

            if (welcomeConfig.embedConfig.color) {
                embed.setColor(welcomeConfig.embedConfig.color);
            }

            if (welcomeConfig.embedConfig.footer) {
                embed.setFooter({
                    text: welcomeConfig.embedConfig.footer
                        .replace('{member.mention}', member.toString())
                        .replace('{member.username}', member.user.username)
                        .replace('{member.id}', member.id)
                        .replace('{guild.name}', member.guild.name)
                        .replace('{guild.id}', member.guild.id)
                        .replace('{memberCount}', member.guild.memberCount.toString())
                });
            }

            // Handle welcome image generation
            if (welcomeConfig.imageGeneration) {
                // Get guild banner or icon URL
                const guildBannerURL = member.guild.bannerURL({ extension: 'png', size: 1024 });
                const guildIconURL = member.guild.iconURL({ extension: 'png', size: 1024 });
                const backgroundURL = guildBannerURL || guildIconURL;

                console.log('Background URL:', backgroundURL);

                // If we don't have a background URL, try to use the utils/imageGenerator.js instead
                if (!backgroundURL) {
                    try {
                        const { generateWelcomeImage } = require('./utils/imageGenerator');
                        const result = await generateWelcomeImage(member, member.guild.name);

                        if (result && result.buffer) {
                            const attachment = new AttachmentBuilder(result.buffer, { name: 'welcome-image.png' });
                            embed.setImage('attachment://welcome-image.png');

                            // Send the welcome message with the attachment
                            await channel.send({
                                content: messageContent.trim() || null,
                                embeds: [embed],
                                files: [attachment]
                            });
                            return; // Exit early since we've sent the message
                        }
                    } catch (error) {
                        console.error('Error using imageGenerator fallback:', error);
                        // Continue without the image if there's an error
                    }
                }

                // Only generate image if guild has a background
                if (backgroundURL) {
                    // Create a Canvas
                    const { createCanvas, loadImage } = require('@napi-rs/canvas');
                    const canvas = createCanvas(1000, 400);
                    const ctx = canvas.getContext('2d');

                    try {
                        // Load background image
                        console.log('Loading background image from URL:', backgroundURL);
                        const background = await loadImage(backgroundURL).catch(err => {
                            console.error('Error loading background image:', err);
                            throw new Error('Failed to load background image');
                        });

                        console.log('Background image loaded successfully');

                        // Draw background with a dark overlay
                        ctx.drawImage(background, 0, 0, canvas.width, canvas.height);

                        // Add a semi-transparent overlay to make text more readable
                        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
                        ctx.fillRect(0, 0, canvas.width, canvas.height);

                        // Removed the red bar on the left side

                        // Load user avatar
                        const avatarURL = member.user.displayAvatarURL({ extension: 'png', size: 512 });
                        console.log('Loading avatar image from URL:', avatarURL);
                        const avatar = await loadImage(avatarURL).catch(err => {
                            console.error('Error loading avatar image:', err);
                            throw new Error('Failed to load avatar image');
                        });
                        console.log('Avatar image loaded successfully');

                        // Draw avatar in a circle
                        const avatarSize = 150;
                        const avatarX = canvas.width / 2 - avatarSize / 2;
                        const avatarY = canvas.height / 2 - avatarSize / 2 - 20; // Slightly above center

                        // Save context state
                        ctx.save();

                        // Create circular clipping path
                        ctx.beginPath();
                        ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2, true);
                        ctx.closePath();
                        ctx.clip();

                        // Draw avatar
                        ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);

                        // Restore context state
                        ctx.restore();

                        // Add white circle border around avatar
                        ctx.beginPath();
                        ctx.arc(canvas.width / 2, avatarY + avatarSize / 2, avatarSize / 2 + 5, 0, Math.PI * 2, true);
                        ctx.strokeStyle = 'white';
                        ctx.lineWidth = 5;
                        ctx.stroke();

                        // Add welcome text
                        ctx.font = '30px sans-serif';
                        ctx.fillStyle = 'white';
                        ctx.textAlign = 'center';
                        ctx.fillText(`@${member.user.username} just joined the server`, canvas.width / 2, avatarY + avatarSize + 50);

                        // Add member count
                        ctx.font = '25px sans-serif';
                        ctx.fillStyle = 'white';
                        ctx.textAlign = 'center';
                        ctx.fillText(`Member #${member.guild.memberCount}`, canvas.width / 2, avatarY + avatarSize + 90);

                        // Convert canvas to buffer
                        const buffer = canvas.toBuffer('image/png');
                        console.log('Canvas buffer created successfully, size:', buffer.length);
                        const attachment = new AttachmentBuilder(buffer, { name: 'welcome-image.png' });

                        // Set the image in the embed
                        embed.setImage('attachment://welcome-image.png');

                        // Send the welcome message with the attachment
                        await channel.send({
                            content: messageContent.trim() || null,
                            embeds: [embed],
                            files: [attachment]
                        });
                        return; // Exit early since we've sent the message
                    } catch (error) {
                        console.error('Error generating welcome image:', error);
                        // Continue without the image if there's an error
                    }
                }
            }

            // If we didn't generate an image or there was an error, add any configured image
            if (welcomeConfig.embedConfig.image && welcomeConfig.embedConfig.image !== '{generateImage}') {
                try {
                    // Validate URL format
                    new URL(welcomeConfig.embedConfig.image);
                    embed.setImage(welcomeConfig.embedConfig.image);
                } catch (error) {
                    console.error('Invalid image URL in welcome config:', error);
                    // Don't set the image if URL is invalid
                }
            }

            if (welcomeConfig.embedConfig.thumbnail) {
                embed.setThumbnail(welcomeConfig.embedConfig.thumbnail
                    .replace('{member.avatar}', member.user.displayAvatarURL({ dynamic: true })));
            }

            embeds.push(embed);
        }

        // Send the welcome message (if we haven't already sent it with an image)
        await channel.send({
            content: messageContent.trim() || null,
            embeds: embeds.length > 0 ? embeds : undefined
        });
    } catch (error) {
        console.error('Error sending welcome message:', error);
    }
});

// Handle message events for keyword responses and Tebex webhooks
client.on('messageCreate', async message => {
    // Process Tebex webhook messages
    if (message.webhookId) {
        try {
            // Check if this is a Tebex webhook message
            if (message.content.includes('Transaction ID:') &&
                (message.content.includes('has received a payment') || message.content.includes('has received a chargeback'))) {

                const guildId = message.guild.id;

                // Check if Tebex verification is set up for this guild
                const tebexConfig = await TebexConfig.findOne({ guildId });
                if (!tebexConfig || !tebexConfig.webhookId !== message.webhookId) {
                    return; // Not our webhook or not set up
                }

                // Parse the message content
                const parts = message.content.split('╽').map(part => part.trim());

                // Extract transaction details
                let username = 'Unknown';
                let price = 'Unknown';
                let packageName = 'Unknown';
                let transactionId = 'Unknown';

                for (const part of parts) {
                    if (part.startsWith('From:')) {
                        username = part.replace('From:', '').trim();
                    } else if (part.startsWith('Price:')) {
                        price = part.replace('Price:', '').trim();
                    } else if (part.startsWith('Package:')) {
                        packageName = part.replace('Package:', '').trim();
                    } else if (part.startsWith('Transaction ID:')) {
                        transactionId = part.replace('Transaction ID:', '').trim();
                    }
                }

                // Store the transaction in the database
                if (transactionId !== 'Unknown') {
                    try {
                        await TebexTransaction.findOneAndUpdate(
                            { guildId, transactionId },
                            {
                                guildId,
                                transactionId,
                                username,
                                packageName,
                                price,
                                verified: false
                            },
                            { upsert: true, new: true }
                        );

                        console.log(`Stored Tebex transaction: ${transactionId}`);
                    } catch (error) {
                        console.error('Error storing Tebex transaction:', error);
                    }
                }
            }
        } catch (error) {
            console.error('Error processing webhook message:', error);
        }

        return; // Don't process webhook messages further
    }

    // Ignore messages from bots
    if (message.author.bot) return;

    // Ignore messages that are not in a guild
    if (!message.guild) return;

    // Handle whitelist auto-role
    try {
        // Check if autoroles module is enabled
        const guildModuleConfig = moduleConfig.get(message.guild.id);
        const autorolesDisabled = guildModuleConfig && guildModuleConfig.disabledModules && guildModuleConfig.disabledModules.includes('autoroles');

        if (!autorolesDisabled) {
            const whitelistConfig = await WhitelistConfig.findOne({
                guildId: message.guild.id,
                enabled: true
            });

            if (whitelistConfig && message.channel.id === whitelistConfig.channelId) {
                // Check if the message contains any whitelist keywords
                const messageContent = message.content.toLowerCase().trim();
                const containsKeyword = whitelistConfig.keywords.some(keyword =>
                    messageContent === keyword.toLowerCase() ||
                    messageContent.includes(keyword.toLowerCase())
                );

                if (containsKeyword) {
                    // Find the whitelist role
                    const whitelistRole = message.guild.roles.cache.find(r =>
                        r.name.toLowerCase() === 'whitelist' || r.name.toLowerCase() === 'whitelisted'
                    );

                    if (whitelistRole) {
                        const member = message.member;

                        // Check if member already has the role
                        if (!member.roles.cache.has(whitelistRole.id)) {
                            try {
                                await member.roles.add(whitelistRole, 'Whitelist auto-role');

                                // Send a confirmation message
                                const confirmEmbed = new EmbedBuilder()
                                    .setTitle('✅ Whitelist Role Assigned')
                                    .setDescription(`${message.author}, you have been given the ${whitelistRole} role!`)
                                    .setColor('#57F287') // Green
                                    .setFooter({ text: `This role will be active for ${whitelistConfig.duration} hour${whitelistConfig.duration === 1 ? '' : 's'}` })
                                    .setTimestamp();

                                // Apply branding
                                applyBranding(confirmEmbed);

                                const confirmMsg = await message.reply({
                                    embeds: [confirmEmbed]
                                });

                                // Schedule role removal after the specified duration
                                setTimeout(async () => {
                                    try {
                                        // Check if member still has the role
                                        const currentMember = await message.guild.members.fetch(member.id).catch(() => null);
                                        if (currentMember && currentMember.roles.cache.has(whitelistRole.id)) {
                                            await currentMember.roles.remove(whitelistRole, 'Whitelist duration expired');

                                            // Notify the user
                                            try {
                                                const expiryEmbed = new EmbedBuilder()
                                                    .setTitle('⏰ Whitelist Role Expired')
                                                    .setDescription(`Your ${whitelistRole.name} role in **${message.guild.name}** has expired after ${whitelistConfig.duration} hour${whitelistConfig.duration === 1 ? '' : 's'}.`)
                                                    .setColor('#FEE75C') // Yellow
                                                    .setTimestamp();

                                                await member.send({ embeds: [expiryEmbed] }).catch(() => {
                                                    console.log(`Could not DM ${member.user.tag} about whitelist expiry`);
                                                });
                                            } catch (error) {
                                                console.log(`Could not DM ${member.user.tag} about whitelist expiry`);
                                            }
                                        }
                                    } catch (error) {
                                        console.error('Error removing whitelist role:', error);
                                    }
                                }, whitelistConfig.duration * 60 * 60 * 1000); // Convert hours to milliseconds

                                console.log(`Assigned whitelist role to ${message.author.tag} in ${message.guild.name}`);
                            } catch (error) {
                                console.error('Error assigning whitelist role:', error);
                            }
                        }
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error processing whitelist auto-role:', error);
    }

    // Handle sticky messages
    try {
        // Check if there's an active sticky message in this channel
        const stickyMessage = await StickyMessage.findOne({
            guildId: message.guild.id,
            channelId: message.channel.id,
            active: true
        });

        if (stickyMessage) {
            // Don't update if the message is from a bot or is the sticky message itself
            if (message.author.bot || stickyMessage.lastMessageId === message.id) return;

            // Always delete the old sticky message if it exists
            if (stickyMessage.lastMessageId) {
                try {
                    const oldMessage = await message.channel.messages.fetch(stickyMessage.lastMessageId).catch(() => null);
                    if (oldMessage) {
                        await oldMessage.delete().catch(() => null);
                    }
                } catch (error) {
                    console.error('Error deleting old sticky message:', error);
                }
            }

            // Create the sticky message embed
            const embed = new EmbedBuilder()
                .setColor('#5865F2') // Discord Blue
                .setFooter({ text: 'Sticky Message' })
                .setTimestamp();

            // Set title based on embedData if available
            if (stickyMessage.embedData && stickyMessage.embedData.title) {
                embed.setTitle(stickyMessage.embedData.title);
            } else {
                embed.setTitle(stickyMessage.title);
            }

            // Set description based on embedData if available
            if (stickyMessage.embedData && stickyMessage.embedData.description) {
                embed.setDescription(stickyMessage.embedData.description);
            } else {
                embed.setDescription(stickyMessage.content);
            }

            // Set image if available in embedData
            if (stickyMessage.embedData && stickyMessage.embedData.image && stickyMessage.embedData.image.trim() !== '') {
                try {
                    // Validate URL format
                    new URL(stickyMessage.embedData.image);
                    embed.setImage(stickyMessage.embedData.image);
                } catch (error) {
                    console.error('Invalid image URL for sticky message:', error);
                }
            }

            // Apply branding
            applyBranding(embed);

            // Prepare message content and embed
            const messageOptions = {};

            // Add content if it exists and is different from embed description
            if (stickyMessage.content &&
                (!stickyMessage.embedData?.description ||
                 stickyMessage.content !== stickyMessage.embedData.description)) {
                messageOptions.content = stickyMessage.content;
            }

            // Add embed
            messageOptions.embeds = [embed];

            // Wait a short delay to make the sticky message appear after the user's message
            setTimeout(async () => {
                try {
                    // Send the sticky message
                    const newStickyMessage = await message.channel.send(messageOptions);

                    // Update the last message ID
                    stickyMessage.lastMessageId = newStickyMessage.id;
                    await stickyMessage.save();
                } catch (error) {
                    console.error('Error sending sticky message:', error);
                }
            }, 500); // 500ms delay
        }
    } catch (error) {
        console.error('Error handling sticky message:', error);
    }

    // Get the content of the message
    const content = message.content.toLowerCase();

    // Check if the message starts with a keyword
    const keyword = await Keyword.findOne({
        guildId: message.guild.id,
        name: { $regex: `^${content.split(/\s+/)[0]}$`, $options: 'i' }
    });

    if (keyword) {
        // Create the embed response
        const embed = new EmbedBuilder()
            .setDescription(keyword.description)
            .setColor(keyword.color);

        if (keyword.footer) embed.setFooter({ text: keyword.footer });
        if (keyword.image) embed.setImage(keyword.image);
        if (keyword.thumbnail) embed.setThumbnail(keyword.thumbnail);

        // Add fields if they exist
        if (keyword.fields && keyword.fields.length > 0) {
            keyword.fields.forEach(field => {
                embed.addFields({
                    name: field.name,
                    value: field.value,
                    inline: field.inline
                });
            });
        }

        // Send the response
        await message.channel.send({ embeds: [embed] });
    }
});

// Global status is now set in the ready event

// Function to load restarts configurations
async function loadRestartsConfigs() {
    try {
        // Clear existing configs
        restartsConfig.clear();

        // Get all restarts configs from the database
        const configs = await RestartsConfig.find({});

        // Load each config into the Map
        for (const configDoc of configs) {
            restartsConfig.set(configDoc.guildId, {
                channelId: configDoc.channelId,
                connectLink: configDoc.connectLink,
                cfxCode: configDoc.cfxCode,
                roleId: configDoc.roleId,
                lastPlayerCount: configDoc.lastPlayerCount,
                debug: config.debug || false
            });
        }

        console.log(`Loaded ${configs.length} restarts configurations`);
    } catch (error) {
        console.error('Error loading restarts configurations:', error);
    }
}

// Function to load application panels
async function loadApplicationPanels() {
    try {
        // Clear existing panels
        applicationPanels.clear();

        // Get all application panels from the database
        const panels = await ApplicationPanel.find({});

        // Load each panel into the Map
        for (const panel of panels) {
            applicationPanels.set(panel.name, {
                name: panel.name,
                type: panel.type,
                channelId: panel.channelId,
                logsChannelId: panel.logsChannelId,
                roleId: panel.roleId,
                resultsChannelId: panel.resultsChannelId,
                questions: panel.questions,
                title: panel.title,
                description: panel.description
            });
        }

        // Only log if panels were loaded
        if (applicationPanels.size > 0) {
            console.log(`Loaded ${applicationPanels.size} application panels`);
        }

        // Load application responses
        await loadApplicationResponses();

        // Load other module configurations
        await loadFeedbackConfig();
        await loadVerificationConfig();
        await loadRestartsConfig();
        await loadVanityRolesConfig();
        await loadBoosterConfig();
        await loadModuleConfig();
    } catch (error) {
        console.error('Error loading application panels:', error);
    }
}

// Function to load application responses
async function loadApplicationResponses() {
    try {
        // Clear existing responses
        applicationResponses.clear();

        // Get all application responses from the database
        const responses = await ApplicationResponse.find({});

        // Load each response into the Map
        for (const response of responses) {
            applicationResponses.set(response.responseId, {
                responseId: response.responseId,
                userId: response.userId,
                panelName: response.panelName,
                answers: response.answers,
                status: response.status,
                timestamp: response.createdAt
            });
        }

        // Only log if responses were loaded
        if (applicationResponses.size > 0) {
            console.log(`Loaded ${applicationResponses.size} application responses`);
        }
    } catch (error) {
        console.error('Error loading application responses:', error);
    }
}

// Function to load feedback configuration
async function loadFeedbackConfig() {
    try {
        // Clear existing config
        feedbackConfig.clear();
        staffFeedback.clear();

        // Get all feedback configs from the database
        const configs = await FeedbackConfig.find({});

        // Load each config into the Map
        for (const config of configs) {
            feedbackConfig.set(config.guildId, {
                staffRoleId: config.staffRoleId,
                feedbackWallId: config.feedbackWallId,
                feedbackLogId: config.feedbackLogId
            });
        }

        // Load staff feedback data
        const feedbacks = await StaffFeedback.find({});

        // Load each feedback into the Map
        for (const feedback of feedbacks) {
            staffFeedback.set(feedback.userId, {
                upvotes: feedback.upvotes,
                downvotes: feedback.downvotes
            });
        }

        // Only log if configs were loaded
        if (feedbackConfig.size > 0) {
            console.log(`Loaded ${feedbackConfig.size} feedback configurations`);
        }
    } catch (error) {
        console.error('Error loading feedback configurations:', error);
    }
}

// Function to load verification configuration
async function loadVerificationConfig() {
    try {
        // Clear existing config
        verificationConfig.clear();

        // Get all verification configs from the database
        const configs = await VerificationConfig.find({});

        // Load each config into the Map
        for (const config of configs) {
            verificationConfig.set(config.guildId, {
                channelId: config.channelId,
                roleId: config.roleId,
                type: config.type,
                embedConfig: config.embedConfig
            });
        }

        // Only log if configs were loaded
        if (verificationConfig.size > 0) {
            console.log(`Loaded ${verificationConfig.size} verification configurations`);
        }
    } catch (error) {
        console.error('Error loading verification configurations:', error);
    }
}

// Function to load restarts configuration
async function loadRestartsConfig() {
    try {
        // Clear existing config
        restartsConfig.clear();

        // Get all restarts configs from the database
        const configs = await RestartsConfig.find({});

        // Load each config into the Map
        for (const config of configs) {
            restartsConfig.set(config.guildId, {
                channelId: config.channelId,
                connectLink: config.connectLink,
                cfxCode: config.cfxCode,
                roleId: config.roleId,
                lastPlayerCount: config.lastPlayerCount
            });
        }

        // Only log if configs were loaded
        if (restartsConfig.size > 0) {
            console.log(`Loaded ${restartsConfig.size} restarts configurations`);
        }
    } catch (error) {
        console.error('Error loading restarts configurations:', error);
    }
}

// Function to load FiveM status configurations
async function loadFiveMStatusConfig() {
    try {
        // Clear existing config
        fivemStatusConfig.clear();

        // Get all FiveM status configs from the database
        const configs = await FiveMStatusConfig.find({});

        // Load each config into the Map
        for (const configDoc of configs) {
            fivemStatusConfig.set(configDoc.guildId, {
                channelId: configDoc.channelId,
                messageId: configDoc.messageId,
                cfxCode: configDoc.cfxCode,
                debug: config.debug || false
            });
        }

        // Only log if configs were loaded
        if (fivemStatusConfig.size > 0) {
            console.log(`Loaded ${fivemStatusConfig.size} FiveM status configurations`);
        }
    } catch (error) {
        console.error('Error loading FiveM status configurations:', error);
    }
}

// Function to apply branding to an embed
function applyBranding(embed) {
    try {
        // If global branding config exists, apply it
        if (global.brandingConfig) {
            // Always apply color from branding config
            if (global.brandingConfig.embedConfig.color) {
                embed.setColor(global.brandingConfig.embedConfig.color);
            }

            // Apply banner image if it exists
            if (global.brandingConfig.embedConfig.banner) {
                embed.setImage(global.brandingConfig.embedConfig.banner);
            }

            // Always apply footer from branding config if it exists
            // This replaces the timestamp with the footer
            if (global.brandingConfig.embedConfig.footer) {
                embed.setFooter({ text: global.brandingConfig.embedConfig.footer });
                // Remove timestamp when footer is applied
                embed.setTimestamp(null);
            }
        }

        return embed;
    } catch (error) {
        console.error('Error applying branding to embed:', error);
        return embed; // Return original embed if error occurs
    }
}

// Function to load vanity roles configuration
async function loadVanityRolesConfig() {
    try {
        // Clear existing config
        vanityRolesConfig.clear();

        // Get all vanity roles configs from the database
        const configs = await VanityRolesConfig.find({});

        // Load each config into the Map
        for (const config of configs) {
            vanityRolesConfig.set(config.guildId, {
                roleId: config.roleId,
                vanityUrl: config.vanityUrl,
                channelId: config.channelId,
                notificationType: config.notificationType || 'channel',
                embedConfig: {
                    description: config.embedConfig?.description || '{member} has added the vanity ({vanityURL}) to their status, their role has been added.',
                    color: config.embedConfig?.color || '#5865F2'
                }
            });
        }

        // Only log if configs were loaded
        if (vanityRolesConfig.size > 0) {
            console.log(`Loaded ${vanityRolesConfig.size} vanity roles configurations`);
        }
    } catch (error) {
        console.error('Error loading vanity roles configurations:', error);
    }
}

// Function to load booster configurations
async function loadBoosterConfig() {
    try {
        // Clear existing config
        boosterConfig.clear();

        // Get all booster configs from the database
        const configs = await BoosterConfig.find({});

        // Load each config into the Map
        for (const config of configs) {
            boosterConfig.set(config.guildId, {
                message: config.message,
                enabled: config.enabled
            });
        }

        // Only log if configs were loaded
        if (boosterConfig.size > 0) {
            console.log(`Loaded ${boosterConfig.size} booster configurations`);
        }
    } catch (error) {
        console.error('Error loading booster configurations:', error);
    }
}

// Function to load module configurations
async function loadModuleConfig() {
    try {
        // Clear existing config
        moduleConfig.clear();

        // Get all module configs from the database
        const configs = await ModuleConfig.find({});

        // Load each config into the Map
        for (const config of configs) {
            moduleConfig.set(config.guildId, {
                disabledModules: config.disabledModules || []
            });
        }

        // Only log if configs were loaded
        if (moduleConfig.size > 0) {
            console.log(`Loaded ${moduleConfig.size} module configurations`);
        }
    } catch (error) {
        console.error('Error loading module configurations:', error);
    }
}

// Bot status is now set globally in the ready event

// Login the bot
client.login(config.bot.token);