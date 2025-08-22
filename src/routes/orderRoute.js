const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
    createOrder,
    getOrder,
    getOrders,
    updateOrderStatus
} = require('../controllers/orderController');

router.post('/orders', authenticate, createOrder);
router.get('/orders/:id', authenticate, getOrder);
router.get('/orders', authenticate, getOrders);
router.put('/orders/:id', authenticate, updateOrderStatus);

module.exports = router;