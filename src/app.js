const express = require('express');
const cors = require('cors');
const app = express();
const connectDB = require('./config/db');
const morgan = require('morgan');
require('dotenv').config();
const userRoutes = require('./routes/userRoute');
const productRoutes = require('./routes/productRoute');
const cartRoutes = require('./routes/cartRoute');
const orderRoutes = require('./routes/orderRoute');

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

connectDB();

app.get('/healthz', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

app.use('/api', userRoutes);
app.use('/api', productRoutes);
app.use('/api', cartRoutes);
app.use('/api', orderRoutes);

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on ${PORT}`);
});

// Graceful shutdown for SIGTERM from Render
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down...');
  server.close(async () => {
    try { await mongoose.connection.close(false); } catch {}
    process.exit(0);
  });
});
