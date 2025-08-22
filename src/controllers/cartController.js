const Cart = require('../models/Cart');
const { requireFields } = require('../utils/util');

async function getOrCreateCart(userId) {
    let cart = await Cart.findOne({ user: userId });
    if (!cart) cart = await Cart.create({ user: userId, items: [] });
    return cart;
};

const getCart = async (req, res) => {
    try {
        const cart = await Cart.findOne({ user: req.user._id }).populate('items.product');
        return res.status(200).json({ cart });
    } catch (error) {
        console.error('Error fetching cart:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

const addItem = async (req, res) => {
    const { product, quantity } = req.body;

    const errMsg = requireFields(req.body, ['product', 'quantity']);
    if (errMsg) return res.status(400).json({ error: errMsg });

    try {
        const cart = await getOrCreateCart(req.user._id);

        const existingItem = cart.items.find(item => item.product.toString() === product);
        if (existingItem) existingItem.quantity += quantity;
        else cart.items.push({ product: product, quantity });

        cart.updatedAt = Date.now();
        await cart.save();

        return res.status(200).json({ cart });
    } catch (error) {
        console.error('Error adding item to cart:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

const updateItemQuantity = async (req, res) => {
    const { productId } = req.params;
    const { quantity } = req.body;

    const errMsg = requireFields(req.body, ['quantity']);
    if (errMsg) return res.status(400).json({ error: errMsg });

    try {
        const cart = await getOrCreateCart(req.user._id);
        const item = cart.items.find(item => item.product.toString() === productId);
        if (!item) {
            return res.status(404).json({ error: 'Item not found in cart' });
        }

        item.quantity = quantity;
        cart.updatedAt = Date.now();
        await cart.save();

        return res.status(200).json({ cart });
    } catch (error) {
        console.error('Error updating item quantity:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

const removeItem = async (req, res) => {
    const { productId } = req.params;

    try {
        const cart = await getOrCreateCart(req.user._id);
        cart.items = cart.items.filter(item => item.product.toString() !== productId);
        cart.updatedAt = Date.now();
        await cart.save();

        return res.status(200).json({ cart });
    } catch (error) {
        console.error('Error removing item from cart:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

const clearCart = async (req, res) => {
    try {
        const cart = await getOrCreateCart(req.user._id);
        
        cart.items = [];
        cart.updatedAt = Date.now();
        await cart.save();

        return res.status(204).send();
    } catch (error) {
        console.error('Error clearing cart:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports = {
    getCart,
    addItem,
    updateItemQuantity,
    removeItem,
    clearCart
};