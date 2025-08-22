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

app.use('/api', userRoutes);
app.use('/api', productRoutes);
app.use('/api', cartRoutes);
app.use('/api', orderRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
