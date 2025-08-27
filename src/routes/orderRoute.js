const express = require('express');
const router = express.Router();
const { authenticate, adminOnly } = require('../middleware/auth');
const {
    createOrder,
    getOrder,
    getOrders,
    updateOrderStatus,
    getMyOrders
} = require('../controllers/orderController');

router.post('/orders', authenticate, createOrder);
router.get('/orders/myOrders', authenticate, getMyOrders);
router.get('/orders/:id', authenticate, getOrder);
router.get('/orders', authenticate, adminOnly, getOrders);
router.put('/orders/:id', authenticate, adminOnly, updateOrderStatus);

module.exports = router;