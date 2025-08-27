const express = require('express');
const router = express.Router();
const { authenticate, adminOnly } = require('../middleware/auth');
const {
    calculateShippingRates,
    createShippingLabel,
    trackShipment,
    getOrderShipping,
    cancelShipment
} = require('../controllers/shippingController');

router.post('/shipping/rates', authenticate, calculateShippingRates);
router.post('/shipping/labels', authenticate, createShippingLabel);
router.get('/shipping/track/:trackingNumber', trackShipment);
router.get('/shipping/orders/:orderId', authenticate, getOrderShipping);
router.delete('/shipping/shipments/:shipmentId', authenticate, cancelShipment);

module.exports = router;