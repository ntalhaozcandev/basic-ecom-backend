const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const { requireFields } = require('../utils/util');
const { ObjectId } = require('mongoose').Types;

const createOrder = async (req, res) => {
    const { shippingAddress, billingAddress, paymentMethod } = req.body;
    const userId = req.user._id;

    const errMsg = requireFields(req.body, ['shippingAddress', 'billingAddress']);
    if (errMsg) return res.status(400).json({ error: errMsg });

    try {
        const cart = await Cart.findOne({ user: userId }).populate('items.product');
        if (!cart || cart.items.length === 0) {
            return res.status(400).json({ error: 'Cart is empty' });
        }

        const snapshotItems = [];
        for (const ci of cart.items) {
            if (!ci.product || !ci.product.isActive) {
                return res.status(400).json({ error: 'Invalid product in cart' });
            }
            if (typeof ci.product.stock === 'number' && ci.product.stock < ci.quantity) {
                return res.status(400).json({ error: `Insufficient stock for product ${ci.product.title}` });
            }
            snapshotItems.push({
                product: ci.product._id,
                title: ci.product.title,
                price: ci.product.price,
                quantity: ci.quantity,
                subtotal: ci.product.price * ci.quantity
            });
        }

        const total = snapshotItems.reduce((sum, item) => sum + item.subtotal, 0);

        for (const ci of cart.items) {
            await Product.updateOne(
                { _id: ci.product._id, stock: { $gte: ci.quantity } },
                { $inc: { stock: -ci.quantity } }
            );
        }

        const order = await Order.create({
            user: req.user._id,
            items: snapshotItems,
            total,
            shippingAddress,
            billingAddress,
            paymentMethod,
            status: 'pending',
            paymentStatus: 'unpaid'
        });

        // Fix: Use findOneAndUpdate to avoid version conflicts
        await Cart.findOneAndUpdate(
            { user: userId },
            { $set: { items: [], updatedAt: new Date() } }
        );

        return res.status(201).json({ order });
    } catch (error) {
        console.log('Error creating order:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

const getOrder = async (req, res) => {
    const { id } = req.params;
    const userId = req.user._id;
    const isAdmin = req.user.role === 'admin';

    try {
        const order = await Order.findById(id).lean();
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        // Only allow if user is admin or owns the order
        if (!isAdmin && String(order.user) !== String(userId)) {
            return res.status(403).json({ error: 'Forbidden: You do not have access to this order' });
        }

        return res.status(200).json({ order });
    } catch (error) {
        console.log('Error fetching order:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

const getOrders = async (req, res) => {
    const { status } = req.query;

    const filter = {};
    if (status) filter.status = status;

    try {
        const orders = await Order.find(filter).sort({ createdAt: -1 }).lean();
        return res.status(200).json({ orders });
    } catch (error) {
        console.log('Error fetching orders:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

const getMyOrders = async (req, res) => {
    const userId = req.user._id;

    try {
        const orders = await Order.find({ user: userId }).sort({ createdAt: -1 }).lean();
        return res.status(200).json({ orders });
    } catch (error) {
        console.log('Error fetching user orders:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

const updateOrderStatus = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    const errMsg = requireFields(req.body, ['status']);
    if (errMsg) return res.status(400).json({ error: errMsg });

    try {
        const order = await Order.findByIdAndUpdate(id, { status }, { new: true, runValidators: true });
        if (!order) return res.status(404).json({ error: 'Order not found' });

        return res.status(200).json({ order });
    } catch (error) {
        console.log('Error updating order status:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

module.exports = {
    createOrder,
    getOrder,
    getOrders,
    updateOrderStatus,
    getMyOrders
};