const mongoose = require('mongoose');
const fs = require('fs');

// Load configuration from config.json
const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));

// MongoDB connection string from config
const MONGODB_URI = config.database.mongoUri || 'mongodb://localhost:27017/elyxir';

// Flag to track connection status
let isConnected = false;

// Set buffer timeout (this is a valid option in mongoose.set)
mongoose.set('bufferTimeoutMS', 3000); // Reduce buffer timeout to 3 seconds

// Connect to MongoDB with connection options
mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000, // Reduce server selection timeout
    socketTimeoutMS: 5000, // Reduce socket timeout
    connectTimeoutMS: 5000, // Reduce connection timeout
    maxPoolSize: 10 // Limit connection pool size
})
.then(() => {
    console.log('Connected to MongoDB');
    isConnected = true;
})
.catch((error) => {
    console.error('MongoDB connection error:', error);
    console.log('Bot will run with limited functionality (no database access)');
});

// Add connection event handlers
mongoose.connection.on('error', (err) => {
    console.error('MongoDB connection error:', err);
    isConnected = false;
});

mongoose.connection.on('disconnected', () => {
    console.log('MongoDB disconnected');
    isConnected = false;
});

mongoose.connection.on('reconnected', () => {
    console.log('MongoDB reconnected');
    isConnected = true;
});

// Export mongoose and connection status
module.exports = {
    mongoose,
    isConnected: () => isConnected
};
