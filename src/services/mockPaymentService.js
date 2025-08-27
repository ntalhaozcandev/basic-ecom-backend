const crypto = require('crypto');
const Order = require('../models/Order');
const { time } = require('console');

const PAYMENT_PROCESSORS = {
    STRIPE: {
        name: 'Stripe',
        processingFee: 0.029, // 2.9% + $0.30
        fixedFee: 0.30,
        successRate: 0.95,
        avgProcessingTime: 2000
    },
    PAYPAL: {
        name: 'PayPal',
        processingFee: 0.0349, // 3.49% + $0.49
        fixedFee: 0.49,
        successRate: 0.93,
        avgProcessingTime: 3000
    },
    APPLE_PAY: {
        name: 'Apple Pay',
        processingFee: 0.029,
        fixedFee: 0.30,
        successRate: 0.97,
        avgProcessingTime: 1500
    },
    GOOGLE_PAY: {
        name: 'Google Pay',
        processingFee: 0.029,
        fixedFee: 0.30,
        successRate: 0.96,
        avgProcessingTime: 1800
    }
};

// Common error scenarios
const PAYMENT_ERRORS = {
    CARD_DECLINED: { code: 'card_declined', message: 'Your card was declined.' },
    INSUFFICIENT_FUNDS: { code: 'insufficient_funds', message: 'Your card has insufficient funds.' },
    EXPIRED_CARD: { code: 'expired_card', message: 'Your card has expired.' },
    INCORRECT_CVC: { code: 'incorrect_cvc', message: 'Your card\'s security code is incorrect.' },
    PROCESSING_ERROR: { code: 'processing_error', message: 'An error occurred while processing your card.' },
    NETWORK_ERROR: { code: 'network_error', message: 'Network error occurred. Please try again.' }
};

class MockPaymentService {

    async createPaymentIntent(amount, currency = 'usd', metadata = {}) {
        try {
            await this._delay(500, 1000);

            // Validate amount
            if (!amount || amount <= 50) {
                throw new Error('Amount must be at least $0.50');
            }

            const paymentIntentId = this._generateId('pi');
            const clientSecret = this._generateClientSecret(paymentIntentId);

            const paymentIntent = {
                id: paymentIntentId,
                amount: Math.round(amount * 100), // in cents
                currency: currency.toLowerCase(),
                status: 'requires_payment_method',
                client_secret: clientSecret,
                metadata,
                created: Math.floor(Date.now() / 1000),
                payment_method: null,
                last_payment_error: null
            };

            if (metadata.orderId) {
                await Order.findByIdAndUpdate(metadata.orderId, {
                    paymentIntentId: paymentIntentId,
                    $push: {
                        'paymentHistory': {
                            action: 'intent_created',
                            paymentIntentId: paymentIntentId,
                            amount: paymentIntent.amount,
                            status: paymentIntent.status,
                            time: new Date()
                        }
                    }
                });
            }

            return {
                success: true,
                payment_intent: paymentIntent
            };
        } catch (error) {
            return {
                success: false,
                error: {
                    type: 'invalid_request_error',
                    message: error.message
                }
            };
        }
    }

    async confirmPaymentIntent(paymentIntentId, paymentMethodData, processor = 'STRIPE') {
        try {
            const processingTime = PAYMENT_PROCESSORS[processor]?.avgProcessingTime || 2000;
            await this._delay(processingTime * 0.5, processingTime * 1.5);

            const order = await Order.findOne({ paymentIntentId });
            if (!order) {
                throw new Error('Payment intent not found');
            }

            if (order.paymentStatus === 'paid') {
                throw new Error('Payment intent already confirmed');
            }

            // Payment method validation simulation
            this._validatePaymentMethod(paymentMethodData);

            // Simulate success/failure based on processor success rate
            const processorConfig = PAYMENT_PROCESSORS[processor];
            const isSuccessful = Math.random() < processorConfig.successRate;

            if(!isSuccessful) {
                // Random payment failure simulation
                const errorKeys = Object.keys(PAYMENT_ERRORS);
                const randomError = PAYMENT_ERRORS[errorKeys[Math.floor(Math.random() * errorKeys.length)]];

                await Order.findByIdAndUpdate(order._id, {
                    $push: {
                        'paymentHistory': {
                            action: 'payment_failed',
                            paymentIntentId: paymentIntentId,
                            error: randomError,
                            timestamp: new Date()
                        }
                    }
                });

                return {
                    success: false,
                    payment_intent: {
                        id: paymentIntentId,
                        status: 'requires_payment_method',
                        last_payment_error: randomError
                    },
                    error: randomError
                };
            }

            // Processing fee calculation
            const amountInDollars = order.paymentInfo.amount / 100;
            const processingFee = Math.round(amountInDollars * processorConfig.processingFee + processorConfig.fixedFee * 100);
            const netAmount = order.paymentInfo.amount - processingFee;

            // Transaction record creation
            const transactionId = this._generateId('txn');
            const paymentInfo = {
                transactionId: transactionId,
                processor: processor,
                payment_method: paymentMethodData.type,
                amount: amountInDollars,
                processingFee: processingFee,
                netAmount: netAmount,
                paidAt: new Date()
            };

            await Order.findByIdAndUpdate(order._id, {
                paymentStatus: 'paid',
                status: 'paid',
                paymentInfo: paymentInfo,
                $push: {
                    'paymentHistory': {
                        action: 'payment_confirmed',
                        paymentIntentId: paymentIntentId,
                        transactionId: transactionId,
                        amount: amountInDollars * 100, // in cents
                        timestamp: new Date()
                    }
                }
            });

            const paymentIntent = {
                id: paymentIntentId,
                amount: amountInDollars * 100, // in cents
                currency: 'usd',
                status: 'succeeded',
                payment_method: paymentMethodData,
                transaction_id: transactionId,
                processing_fee: processingFee * 100, // in cents
                net_amount: netAmount * 100 // in cents
            };

            const transaction = {
                id: transactionId,
                payment_intent_id: paymentIntentId,
                amount: amountInDollars * 100,
                currency: 'usd',
                net_amount: netAmount * 100,
                processing_fee: processingFee * 100,
                processor: processor,
                payment_method: paymentMethodData,
                status: 'succeeded',
                created: Math.floor(Date.now() / 1000),
                metadata: { orderId: order._id.toString() }
            };

            return {
                success: true,
                payment_intent: paymentIntent,
                transaction
            };
        } catch (error) {
            return {
                success: false,
                error: {
                    type: 'card_error',
                    message: error.message
                }
            };
        }
    }

    async processPayment(amount, paymentMethodData, processor = 'STRIPE', metadata = {}) {
        try {
            const intentResult = await this.createPaymentIntent(amount, 'usd', metadata);

            if (!intentResult.success) {
                return intentResult;
            }

            const confirmResult = await this.confirmPaymentIntent(
                intentResult.payment_intent.id,
                paymentMethodData,
                processor
            );

            return confirmResult;
        } catch (error) {
            return {
                success: false,
                error: {
                    type: 'processing_error',
                    message: error.message
                }
            };
        }
    }

    async processRefund(transactionId, amount = null, reason = 'requested_by_customer') {
        try {
            await this._delay(1000, 2000);

            const order = await Order.findOne({ 'paymentInfo.transactionId': transactionId });
            if (!order) {
                throw new Error('Transaction not found');
            }

            if (order.paymentStatus !== 'paid') {
                throw new Error('Only paid orders can be refunded');
            }

            const refundAmount = amount || order.paymentInfo.amount;

            if (refundAmount > order.paymentInfo.amount) {
                throw new Error('Refund amount exceeds original transaction amount');
            }

            const totalRefunded = order.refunds ? order.refunds.reduce((sum, r) => sum + r.amount, 0) : 0;
            
            if (totalRefunded >= order.paymentInfo.amount) {
                throw new Error('Transaction has already been fully refunded');
            }

            if (totalRefunded + refundAmount > order.paymentInfo.amount) {
                throw new Error('Refund amount would exceed available balance');
            }

            const isSuccessful = Math.random() < 0.95; // 95% success rate for refunds
            if (!isSuccessful) {
                throw new Error('Refund processing failed. Please try again later.');
            }

            const refundId = this._generateId('ref');
            const refund = {
                refundId: refundId,
                amount: refundAmount,
                reason,
                processedAt: new Date()
            };

            const updateData = {
                $push: { refunds: refund }
            };

            if (totalRefunded + refundAmount === order.paymentInfo.amount) {
                updateData.paymentStatus = 'refunded';
                updateData.status = 'canceled';
            }

            await Order.findByIdAndUpdate(order._id, updateData);

            return {
                success: true,
                refund: {
                    id: refundId,
                    transaction_id: transactionId,
                    amount: refundAmount,
                    currency: 'usd',
                    reason,
                    status: 'succeeded',
                    created: Math.floor(Date.now() / 1000)
                }
            };
        } catch (error) {
            return {
                success: false,
                error: {
                    type: 'refund_error',
                    message: error.message
                }
            };
        }
    }

    async getPaymentIntent(paymentIntentId) {
        try {
            await this._delay(200, 500);

            const order = await Order.findOne({ paymentIntentId });

            if (!order) {
                return {
                    success: false,
                    error: {
                        type: 'invalid_request_error',
                        message: 'Payment intent not found'
                    }
                };
            }

            const paymentIntent = {
                id: paymentIntentId,
                amount: order.total * 100, // in cents
                currency: 'usd',
                status: order.paymentStatus === 'paid' ? 'succeeded' : 'requires_payment_method',
                metadata: {
                    orderId: order._id.toString(),
                    userId: order.user.toString()
                },
                created: Math.floor(order.createdAt.getTime() / 1000)
            }

            if (order.paymentInfo) {
                paymentIntent.payment_method = {
                    type: order.paymentInfo.paymentMethod
                };
                paymentIntent.transaction_id = order.paymentInfo.transactionId;
            }

            return {
                success: true,
                payment_intent: paymentIntent
            };
        } catch (error) {
            return {
                success: false,
                error: {
                    type: 'api_error',
                    message: error.message
                }
            };
        }
    }

    async getTransaction(transactionId) {
        try {
            await this._delay(200, 500);

            const order = await Order.findOne({ 'paymentInfo.transactionId': transactionId });

            if (!order || !order.paymentInfo) {
                return {
                    success: false,
                    error: {
                        type: 'invalid_request_error',
                        message: 'Transaction not found'
                    }
                };
            }

            const transaction = {
                id: transactionId,
                payment_intent_id: order.paymentIntentId,
                amount: order.paymentInfo.amount * 100, // in cents
                currency: 'usd',
                net_amount: order.paymentInfo.netAmount * 100,
                processing_fee: order.paymentInfo.processingFee * 100,
                processor: order.paymentInfo.processor,
                payment_method: {
                    type: order.paymentInfo.paymentMethod
                },
                status: 'succeeded',
                created: Math.floor(order.paymentInfo.paidAt.getTime() / 1000),
                metadata: {
                    orderId: order._id.toString(),
                    userId: order.user.toString()
                },
                refunds: order.refunds || []
            };

            return {
                success: true,
                transaction
            };
        } catch (error) {
            return {
                success: false,
                error: {
                    type: 'api_error',
                    message: error.message
                }
            }
        }
    }

    // Private helper methods
    _validatePaymentMethod(paymentMethodData) {
        const { type, card, billing_details } = paymentMethodData;

        if (!type) {
            throw new Error('Payment method type is required');
        }

        if (type === 'card') {
            if (!card || !card.number || !card.exp_month || !card.exp_year || !card.cvc) {
                throw new Error('Incomplete card details');
            }

            // Card validation simulation
            this._validateCardNumber(card.number);
            this._validateExpiry(card.exp_month, card.exp_year);
            this._validateCVC(card.cvc);
        }

        if (billing_details && !billing_details.email) {
            throw new Error('Billing details email is required');
        }
    }

    _validateCardNumber(cardNumber) {
        const cleaned = cardNumber.replace(/\s+/g, '');

        // Test card numbers that should be declined
        const declinedCards = [
            '4000000000000002', // Generic decline
            '4000000000000069', // Expired card
            '4000000000000127', // Incorrect CVC
            '4000000000000119'  // Processing error
        ];

        if (declinedCards.includes(cleaned)) {
            const errorTypes = ['CARD_DECLINED', 'EXPIRED_CARD', 'INCORRECT_CVC', 'PROCESSING_ERROR'];
            const errorType = errorTypes[declinedCards.indexOf(cleaned) % errorTypes.length];
            throw new Error(PAYMENT_ERRORS[errorType].message);
        }

        // Basic Luhn algorithm check for realistic validation
        if (!this._luhnCheck(cleaned)) {
            throw new Error('Invalid card number');
        }
    }

    _validateExpiry(month, year) {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;

        if (year < currentYear || (year === currentYear && month < currentMonth)) {
            throw new Error('Card has expired');
        }
    }

    _validateCVC(cvc) {
        if (!/^\d{3,4}$/.test(cvc)) {
            throw new Error('Invalid CVC');
        }
    }

    _luhnCheck(cardNumber) {
        const digits = cardNumber.split('').map(Number);
        let sum = 0;

        for (let i = digits.length -1; i >= 0; i--) {
            let digit = digits[i];

            if ((digits.length - i) % 2 === 0) {
                digit *= 2;
                if (digit > 9) digit -= 9;
            }

            sum += digit;
        }

        return sum % 10 === 0;
    }

    _generateId(prefix) {
        const timestamp = Date.now().toString(36);
        const random = crypto.randomBytes(6).toString('hex');
        return `${prefix}_${timestamp}${random}`;
    }

    _generateClientSecret(paymentIntentId) {
        const secret = crypto.randomBytes(16).toString('hex');
        return `${paymentIntentId}_secret_${secret}`;
    }

    async _delay(minMs, maxMs) {
        const delay = Math.floor(Math.random() * (maxMs - minMs)) + minMs;
        return new Promise(resolve => setTimeout(resolve, delay));
    }
};

module.exports = new MockPaymentService();
