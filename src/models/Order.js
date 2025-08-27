const mongoose = require('mongoose');
const { Schema } = mongoose;

const orderItemSchema = Schema({
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    title: String,
    price: Number,
    quantity: { type: Number, required: true, min: 1 },
    subtotal: Number
}, { _id: false });

const addressSchema = new Schema({
    fullName: String,
    line1: String,
    line2: String,
    city: String,
    state: String,
    postalCode: String,
    country: { type: String, default: 'US' },
    phone: String
}, { _id: false });

const paymentSchema = new Schema({
    transactionId: String,
    processor: String,
    paymentMethod: String,
    amount: Number,
    processingFee: Number,
    netAmount: Number,
    paidAt: Date
}, { _id: false });

const shipmentSchema = new Schema({
    shipmentId: String,
    trackingNumber: String,
    carrier: {
        id: String,
        name: String,
        service: String
    },
    shippingCost: Number,
    labelUrl: String,
    estimatedDeliveryDate: String,
    status: String,
    createdAt: Date,
    cancelledAt: Date
}, { _id: false });

const paymentHistorySchema = new Schema({
    action: { type: String, enum: ['intent_created', 'payment_confirmed', 'payment_failed', 'refund_processed'] },
    paymentIntentId: String,
    transactionId: String,
    amount: Number,
    status: String,
    error: Schema.Types.Mixed,
    timestamp: { type: Date, default: Date.now }
}, { _id: false });

const shippingHistorySchema = new Schema({
    action: { type: String, enum: ['rates_calculated', 'label_created', 'shipment_cancelled', 'status_updated'] },
    shipmentId: String,
    trackingNumber: String,
    status: String,
    location: String,
    timestamp: { type: Date, default: Date.now }
}, { _id: false });

const orderSchema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    items: { type: [orderItemSchema], required: true },
    total: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ['pending', 'paid', 'shipped', 'completed', 'canceled'], default: 'pending' },
    shippingAddress: addressSchema,
    billingAddress: addressSchema,
    paymentMethod: { type: String },
    paymentStatus: { type: String, enum: ['unpaid', 'paid', 'refunded'], default: 'unpaid' },
    placedAt: { type: Date, default: Date.now },
    paymentIntentId: { type: String },
    refunds: [{
        refundId: String,
        amount: Number,
        reason: String,
        processedAt: Date
    }],
    paymentInfo: paymentSchema,
    shippingInfo: shipmentSchema,
    paymentHistory: { type: [paymentHistorySchema], default: [] },
    shippingHistory: { type: [shippingHistorySchema], default: [] }
}, { timestamps: true });

orderSchema.pre('validate', function(next) {
    this.items.forEach(i => {
        i.subtotal = i.price * i.quantity;
    });
    this.total = this.items.reduce((sum, i) => sum + i.subtotal, 0);
    next();
});

module.exports = mongoose.model('Order', orderSchema);