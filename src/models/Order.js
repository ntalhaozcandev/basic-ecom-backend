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
    paidAt: Date,
    status: { type: String, enum: ['pending', 'completed', 'failed', 'refunded'] }
}, { _id: false });

const shipmentSchema = new Schema({
    shipmentId: String,
    trackingNumber: String,
    carrier: {
        name: String,
        service: String
    },
    cost: Number,
    labelUrl: String,
    estimatedDelivery: Date,
    status: { type: String, enum: ['created', 'picked_up', 'in_transit', 'delivered'] }
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
    paymentInfo: paymentSchema,
    shippingInfo: shipmentSchema
}, { timestamps: true });

orderSchema.pre('validate', function(next) {
    this.items.forEach(i => {
        i.subtotal = i.price * i.quantity;
    });
    this.total = this.items.reduce((sum, i) => sum + i.subtotal, 0);
    next();
});

module.exports = mongoose.model('Order', orderSchema);