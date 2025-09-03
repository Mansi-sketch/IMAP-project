const { MongoClient } = require('mongodb');

let db;
let client;

const connectDB = async () => {
    try {
        const mongoUrl = process.env.MONGO_URL;
        const dbName = process.env.DB_NAME;
        
        if (!mongoUrl || !dbName) {
            throw new Error('MONGO_URL and DB_NAME environment variables are required');
        }
        
        client = new MongoClient(mongoUrl);
        await client.connect();
        db = client.db(dbName);
        
        console.log('Connected to MongoDB successfully');
        return db;
    } catch (error) {
        console.error('MongoDB connection error:', error);
        throw error;
    }
};

const getDB = () => {
    if (!db) {
        throw new Error('Database not initialized. Call connectDB first.');
    }
    return db;
};

const closeDB = async () => {
    if (client) {
        await client.close();
        console.log('MongoDB connection closed');
    }
};

module.exports = {
    connectDB,
    getDB,
    closeDB
};