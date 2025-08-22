const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
    getCart,
    addItem,
    removeItem,
    updateItemQuantity,
    clearCart
} = require('../controllers/cartController');

router.post('/cart', authenticate, addItem);
router.delete('/cart/:productId', authenticate, removeItem);
router.put('/cart/:productId', authenticate, updateItemQuantity);
router.delete('/cart', authenticate, clearCart);
router.get('/cart', authenticate, getCart);

module.exports = router;