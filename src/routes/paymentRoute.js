const express = require('express');
const router = express.Router();
const { authenticate, adminOnly } = require('../middleware/auth');
const {
    createPaymentIntent,
    confirmPaymentIntent,
    processPayment,
    processRefund,
    getPaymentIntent,
    getTransaction,
    getPaymentHistory
} = require('../controllers/paymentController');

router.post('/payments/intents', authenticate, createPaymentIntent);
router.post('/payments/intents/:paymentIntentId/confirm', authenticate, confirmPaymentIntent);
router.get('/payments/intents/:paymentIntentId', authenticate, getPaymentIntent);
router.post('/payments/process', authenticate, processPayment);
router.post('/payments/refund', authenticate, processRefund);
router.get('/payments/history', authenticate, getPaymentHistory);
router.get('/payments/:transactionId', authenticate, getTransaction);

module.exports = router;
