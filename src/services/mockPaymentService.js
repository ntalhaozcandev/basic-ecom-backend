const crypto = require('crypto');
const { ref } = require('process');

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

// Mock database for storing payment intents and transactions
const mockPaymentIntents = new Map();
const mockTransactions = new Map();
const mockCustomers = new Map();
const mockRefunds = new Map();

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

            mockPaymentIntents.set(paymentIntentId, paymentIntent);

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

            const paymentIntent = mockPaymentIntents.get(paymentIntentId);
            if (!paymentIntent) {
                throw new Error('Payment intent not found');
            }

            if (paymentIntent.status !== 'requires_payment_method' &&
                paymentIntent.status !== 'requires_confirmation') {
                    throw new Error('Payment intent cannot be confirmed in its current status');
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

                paymentIntent.status = 'requires_payment_method';
                paymentIntent.last_payment_error = {
                    ...randomError,
                    payment_method: paymentMethodData
                };

                return {
                    success: false,
                    payment_intent: paymentIntent,
                    error: randomError
                };
            }

            // Processing fee calculation
            const amountInDollars = paymentIntent.amount / 100;
            const processingFee = Math.round(amountInDollars * processorConfig.processingFee + processorConfig.fixedFee * 100);
            const netAmount = paymentIntent.amount - processingFee;

            // Transaction record creation
            const transactionId = this._generateId('txn');
            const transaction = {
                id: transactionId,
                payment_intent_id: paymentIntentId,
                amount: paymentIntent.amount,
                currency: paymentIntent.currency,
                net_amount: netAmount,
                processing_fee: processingFee,
                processor: processor,
                payment_method: paymentMethodData,
                status: 'succeeded',
                created: Math.floor(Date.now() / 1000),
                metadata: paymentIntent.metadata
            };

            mockTransactions.set(transactionId, transaction);

            // Update payment intent
            paymentIntent.status = 'succeeded';
            paymentIntent.payment_method = paymentMethodData;
            paymentIntent.transaction_id = transactionId;
            paymentIntent.processing_fee = processingFee;
            paymentIntent.net_amount = netAmount;

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

            const transaction = mockTransactions.get(transactionId);
            if (!transaction) {
                throw new Error('Transaction not found');
            }

            if (transaction.status !== 'succeeded') {
                throw new Error('Only successful transactions can be refunded');
            }

            const refundAmount = amount || transaction.amount;

            if (refundAmount > transaction.amount) {
                throw new Error('Refund amount exceeds original transaction amount');
            }

            const existingRefunds = Array.from(mockRefunds.values())
                .filter(r => r.transaction_id === transactionId && r.status === 'succeeded');

            const totalRefunded = existingRefunds.reduce((sum, r) => sum + r.amount, 0);

            if (totalRefunded + refundAmount > transaction.amount) {
                throw new Error('Refund amount would exceed available balance');
            }

            const isSuccessful = Math.random() < 0.95; // 95% success rate for refunds
            if (!isSuccessful) {
                throw new Error('Refund processing failed. Please try again later.');
            }

            const refundId = this._generateId('ref');
            const refund = {
                id: refundId,
                transaction_id: transactionId,
                amount: refundAmount,
                currency: transaction.currency,
                reason,
                status: 'succeeded',
                created: Math.floor(Date.now() / 1000),
                metadata: { original_transaction: transactionId }
            };

            mockRefunds.set(refundId, refund);

            if (totalRefunded + refundAmount === transaction.amount) {
                transaction.status = 'refunded';
            }

            return {
                success: true,
                refund
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

            const paymentIntent = mockPaymentIntents.get(paymentIntentId);

            if (!paymentIntent) {
                return {
                    success: false,
                    error: {
                        type: 'invalid_request_error',
                        message: 'Payment intent not found'
                    }
                };
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

            const transaction = mockTransactions.get(transactionId);

            if (!transaction) {
                return {
                    success: false,
                    error: {
                        type: 'invalid_request_error',
                        message: 'Transaction not found'
                    }
                };
            }

            const refunds = Array.from(mockRefunds.values())
                .filter(r => r.transaction_id === transactionId);

            return {
                success: true,
                transaction: {
                    ...transaction,
                    refunds
                }
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

    async simulateWebhook(eventType, objectId) {
        const webhookEvents = {
            'payment_intent.succeeded': () => mockPaymentIntents.get(objectId),
            'payment_intent.payment_failed': () => mockPaymentIntents.get(objectId),
            'charge.succeeded': () => mockTransactions.get(objectId),
            'charge.refunded': () => mockTransactions.get(objectId)
        };

        const eventData = webhookEvents[eventType]?.();

        if (!eventData) {
            return {
                success: false,
                error: 'Invalid event type or object not found'
            };
        }

        return {
            success: true,
            event: {
                id: this._generateId('evt'),
                type: eventType,
                data: {
                    object: eventData
                },
                created: Math.floor(Date.now() / 1000)
            }
        };
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
