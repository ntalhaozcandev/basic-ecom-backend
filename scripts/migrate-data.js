const mongoose = require('mongoose');
const path = require('path');

// Load .env file with absolute path to ensure we get the right one
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const User = require('../src/models/User');
const Product = require('../src/models/Product');
const Order = require('../src/models/Order');
const Cart = require('../src/models/Cart');

async function migrateData() {
    try {
        const uri = process.env.DB_URI;
        if (!uri) {
            console.log('uri:', uri);
            throw new Error('DB_URI is not defined in .env file');
        }
        
        // Verify we're using cloud URI
        if (uri.includes('localhost')) {
            console.log('⚠️  WARNING: Still using localhost URI!');
            console.log('Expected cloud URI, got:', uri);
            return;
        }

        console.log('Connecting to cloud database...');
        await mongoose.connect(uri);

        console.log('✅ Connected successfully!');
        console.log('📍 Connection details:');
        console.log('  Host:', mongoose.connection.host);
        console.log('  Port:', mongoose.connection.port);
        console.log('  Database name:', mongoose.connection.name);
        console.log('  Connection state:', mongoose.connection.readyState);
        console.log('');

        console.log('Fetching data from cloud...');
        const users = await User.find({}).lean();
        const products = await Product.find({}).lean();
        const orders = await Order.find({}).lean();
        const carts = await Cart.find({}).lean();

        console.log(`Found: ${users.length} users, ${products.length} products, ${orders.length} orders, ${carts.length} carts`);

        await mongoose.disconnect();

        console.log('Connecting to local database...');
        await mongoose.connect('mongodb://root:password@localhost:27017/ecom-local?authSource=admin');

        console.log('📍 Local connection details:');
        console.log('  Host:', mongoose.connection.host);
        console.log('  Port:', mongoose.connection.port);
        console.log('  Database name:', mongoose.connection.name);
        console.log('');

        console.log('Clearing local database...');
        await User.deleteMany({});
        await Product.deleteMany({});
        await Order.deleteMany({});
        await Cart.deleteMany({});

        console.log('Inserting data into local database...');
        if (users.length > 0) await User.insertMany(users);
        if (products.length > 0) await Product.insertMany(products);
        if (orders.length > 0) await Order.insertMany(orders);
        if (carts.length > 0) await Cart.insertMany(carts);

        console.log('Data migration completed successfully.');
    } catch (error) {
        console.error('Error during data migration:', error);
    } finally {
        await mongoose.disconnect();
    }
}

migrateData();