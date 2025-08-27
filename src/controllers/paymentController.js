const mockPaymentService = require('../services/mockPaymentService');
const Order = require('../models/Order');
const { requireFields, successResponse, errorResponse } = require('../utils/util');
const { ObjectId } = require('mongoose').Types;

const createPaymentIntent = async (req, res) => {
    const { amount, currency = 'usd', orderId, metadata = {} } = req.body;

    const errMsg = requireFields(req.body, ['amount']);
    if (errMsg) return errorResponse(res, errMsg, 400);

    try {
        if (amount <= 0) {
            return errorResponse(res, 'Amount must be greater than 0', 400);
        }

        let order = null;
        if (orderId) {
            if (!ObjectId.isValid(orderId)) {
                return errorResponse(res, 'Invalid orderId', 400);
            }

            order = await Order.findById(orderId);
            if (!order) {
                return errorResponse(res, 'Order not found', 404);
            }

            if (String(order.user) !== String(req.user._id)) {
                return errorResponse(res, 'Unauthorized for this order', 403);
            }

            if (Math.abs(amount - order.total) > 0.01) {
                return errorResponse(res, 'Amount must match order total', 400);
            }
        }

        const paymentMetadata = {
            ...metadata,
            userId: req.user._id.toString(),
            userEmail: req.user.email,
            ...(orderId && { orderId: orderId.toString() })
        };

        const result = await mockPaymentService.createPaymentIntent(amount, currency, paymentMetadata);

        if (!result.success) {
            return errorResponse(res, result.error, 400);
        }

        if (order) {
            order.paymentIntentId = result.payment_intent.id;
            await order.save();
        }

        return successResponse(res, {
            paymentIntent: result.payment_intent
        }, 'Payment intent created', 201);
    } catch (error) {
        console.error('Error creating payment intent:', error);
        return errorResponse(res, 'Internal server error', 500);
    }
}

const confirmPaymentIntent = async (req, res) => {
    const { paymentIntentId, paymentMethodData, processor = 'STRIPE' } = req.body;

    const errMsg = requireFields(req.body, ['paymentIntentId', 'paymentMethodData']);
    if (errMsg) return errorResponse(res, errMsg, 400);

    try {
        if (!paymentMethodData.type) {
            return errorResponse(res, 'Payment method type is required', 400);
        }

        const result = await mockPaymentService.confirmPaymentIntent(paymentIntentId, paymentMethodData, processor);
        
        if (!result.success) {
            return errorResponse(res, result.error, 400);
        }

        const order = await Order.findOne({ paymentIntentId });

        if (order) {
            order.paymentStatus = 'paid';
            order.status = 'paid';
            order.paymentInfo = {
                transactionId: result.transaction.id,
                processor,
                paymentMethod: paymentMethodData.type,
                amount: result.transaction.amount,
                processingFee: result.transaction.processing_fee,
                netAmount: result.transaction.net_amount,
                paidAt: new Date()
            }
            await order.save();
        }

        return successResponse(res, {
            paymentIntent: result.payment_intent,
            transaction: result.transaction
        }, 'Payment confirmed', 200);
    } catch (error) {
        console.error('Error confirming payment:', error);
        return errorResponse(res, 'Internal server error', 500);
    }
}

const processPayment = async (req, res) => {
    const { amount, paymentMethodData, processor = 'STRIPE', orderId, metadata = {} } = req.body;

    const errMsg = requireFields(req.body, ['amount', 'paymentMethodData']);
    if (errMsg) return errorResponse(res, errMsg, 400);

    try {
        if (amount <= 0) {
            return errorResponse(res, 'Amount must be greater than 0', 400);
        }

        let order = null;
        if (orderId) {
            if (!ObjectId.isValid(orderId)) {
                return errorResponse(res, 'Invalid orderId', 400);
            }

            order = await Order.findById(orderId);
            if (!order) {
                return errorResponse(res, 'Order not found', 404);
            }

            if (String(order.user) !== String(req.user._id)) {
                return errorResponse(res, 'Unauthorized for this order', 403);
            }

            if (order.paymentStatus === 'paid') {
                return errorResponse(res, 'Order already paid', 400);
            }

            if (Math.abs(amount - order.total) > 0.01) {
                return errorResponse(res, 'Amount must match order total', 400);
            }
        }

        const paymentMetadata = {
            ...metadata,
            userId: req.user._id,
            userEmail: req.user.email,
            ...(orderId && { orderId: orderId.toString() })
        };

        const result = await mockPaymentService.processPayment(amount, paymentMethodData, processor, paymentMetadata);
        if (!result.success) {
            return errorResponse(res, result.error, 400);
        }

        if (order) {
            order.paymentStatus = 'paid';
            order.status = 'paid';
            order.paymentIntentId = result.payment_intent.id;
            order.paymentInfo = {
                transactionId: result.transaction.id,
                processor,
                paymentMethod: paymentMethodData.type,
                amount: result.transaction.amount,
                processingFee: result.transaction.processing_fee,
                netAmount: result.transaction.net_amount,
                paidAt: new Date()
            };
            await order.save();
        }

        return successResponse(res, {
            paymentIntent: result.payment_intent,
            transaction: result.transaction
        }, 'Payment processed', 200);
    } catch (error) {
        console.error('Error processing payment:', error);
        return errorResponse(res, 'Internal server error', 500);
    }
}

const processRefund = async (req, res) => {
    const { transactionId, amount, reason = 'requested_by_customer' } = req.body;

    const errMsg = requireFields(req.body, ['transactionId']);
    if (errMsg) return errorResponse(res, errMsg, 400);

    try {
        const order = await Order.findOne({ 'paymentInfo.transactionId': transactionId });
        if (!order) {
            return errorResponse(res, 'Order not found', 404);
        }

        const isAdmin = req.user.role === 'admin';
        if (!isAdmin && String(order.user) !== String(req.user._id)) {
            return errorResponse(res, 'Unauthorized for this order', 403);
        }

        const result = await mockPaymentService.processRefund(transactionId, amount, reason);
        if (!result.success) {
            return errorResponse(res, result.error, 400);
        }

        if (!amount || amount >= order.paymentInfo.amount) {
            order.paymentStatus = 'refunded';
            order.status = 'canceled';
        }

        if (!order.refunds) {
            order.refunds = [];
        }

        order.refunds.push({
            refundId: result.refund.id,
            amount: result.refund.amount,
            reason: result.refund.reason,
            processedAt: new Date()
        });

        await order.save();

        return successResponse(res, {
            refund: result.refund
        }, 'Refund processed', 201);
    } catch (error) {
        console.error('Error processing refund:', error);
        return errorResponse(res, 'Internal server error', 500);
    }
}

const getPaymentIntent = async (req, res) => {
    const { paymentIntentId } = req.params;

    if (!paymentIntentId) {
        return errorResponse(res, 'Missing paymentIntentId parameter', 400);
    }

    try {
        const result = await mockPaymentService.getPaymentIntent(paymentIntentId);

        if (!result.success) {
            return errorResponse(res, result.error, 400);
        }

        const userId = result.payment_intent.metadata?.userId;
        const isAdmin = req.user.role === 'admin';

        if (!isAdmin && userId !== req.user._id.toString()) {
            return errorResponse(res, 'Unauthorized to access this payment intent', 403);
        }

        return successResponse(res, {
            paymentIntent: result.payment_intent
        }, 'Payment intent retrieved', 200);
    } catch (error) {
        console.error('Error retrieving payment intent:', error);
        return errorResponse(res, 'Internal server error', 500);
    }
}

const getTransaction = async (req, res) => {
    const { transactionId } = req.params;

    if (!transactionId) {
        return errorResponse(res, 'Missing transactionId parameter', 400);
    }

    try {
        const result = await mockPaymentService.getTransaction(transactionId);
        if (!result.success) {
            return errorResponse(res, result.error, 400);
        }

        const userId = result.transaction.metadata?.userId;
        const isAdmin = req.user.role === 'admin';

        if (!isAdmin && userId !== req.user._id.toString()) {
            return errorResponse(res, 'Unauthorized to access this transaction', 403);
        }

        return successResponse(res, {
            transaction: result.transaction
        }, 'Transaction retrieved', 200);
    } catch (error) {
        console.error('Error retrieving transaction:', error);
        return errorResponse(res, 'Internal server error', 500);
    }
}

const getPaymentHistory = async (req, res) => {
    const { page = 1, limit = 10, status } = req.query;

    try {
        const filter = { user: req.user._id };
        if (status) {
            filter.paymentStatus = status;
        }

        const skip = (Number(page) - 1) * Number(limit);

        const orders = await Order.find(filter)
            .select('_id total paymentStatus paymentInfo createdAt')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit))
            .lean();

            const total = await Order.countDocuments(filter);

            return successResponse(res, {
                payments: orders,
                pagination: {
                    total,
                    page: Number(page),
                    pages: Math.ceil(total / Number(limit)),
                    limit: Number(limit)
                }
            }, 'Payment history retrieved', 200);
    } catch (error) {
        console.error('Error retrieving payment history:', error);
        return errorResponse(res, 'Internal server error', 500);
    }
}

module.exports = {
    createPaymentIntent,
    confirmPaymentIntent,
    processPayment,
    processRefund,
    getPaymentIntent,
    getTransaction,
    getPaymentHistory
};