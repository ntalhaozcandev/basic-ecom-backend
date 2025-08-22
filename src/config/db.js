const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = async () => {
    try {
        const uri = process.env.DB_URI;
        if (!uri) {
            console.log('uri:', uri);
            throw new Error('DB_URI is not defined in .env file');
        }
        const conn = await mongoose.connect(uri);
        console.log(`Connected to MongoDB: ${conn.connection.host}`);
    } catch (error) {
        console.error(`Error connecting to MongoDB: ${error.message}`);
        process.exit(1);
    }
};

module.exports = connectDB;