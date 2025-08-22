const mongoose = require('mongoose');
const { Schema } = mongoose;

const cartItemSchema = new Schema({
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, default: 1, min: 1 },
}, { _id: false });

const cartSchema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: 'User', unique: true, required: true },
    items: [cartItemSchema],
    updatedAt: { type: Date, default: Date.now }
});

cartSchema.methods.clear = function() {
    this.items = [];
    return this.save();
};

module.exports = mongoose.model('Cart', cartSchema);