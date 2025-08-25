const Product = require('../models/Product');
const { requireFields } = require('../utils/util');
const { ObjectId } = require('mongoose').Types;

const createProduct = async (req, res) => {
    const { title, sku, description, category, price, stock, images, isActive } = req.body;

    const errMsg = requireFields(req.body, ['title', 'category', 'price', 'stock']);
    if (errMsg) return res.status(400).json({ message: errMsg });
    
    try {
        const existingProduct = await Product.findOne({ title });
        if (existingProduct) {
            return res.status(400).json({ message: 'Product already exists' });
        }

        const product = new Product({ title, sku, description, category, price, stock, images, isActive });
        await product.save();
        return res.status(201).json({ message: 'Product created successfully', product });
    } catch (error) {
        console.error('Error creating product:', error);
        return res.status(500).json({ message: 'Internal server error', error });
    }
};

const getProduct = async (req, res) => {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ message: 'Invalid product ID' });
    }

    try {
        const product = await Product.findOne({ _id: id });
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        return res.status(200).json(product);
    } catch (error) {
        console.error(`Error fetching product: ${error.message}`);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

const getAllProducts = async (req, res) => {
    const { category, minPrice, maxPrice, isActive, search, page = 1, limit = 10 } = req.query;

    const filter = {};
    if (category) filter.category = category;
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (minPrice) filter.price = { ...filter.price, $gte: Number(minPrice) };
    if (maxPrice) filter.price = { ...filter.price, $lte: Number(maxPrice) };
    if (search) filter.title = { $regex: search, $options: 'i' };

    const skip = (Number(page) - 1) * Number(limit);

    try {
        const products = await Product.find(filter)
            .skip(skip)
            .limit(Number(limit));
        const total = await Product.countDocuments(filter);

        return res.status(200).json({
            products,
            total,
            page: Number(page),
            pages: Math.ceil(total / Number(limit))
        });
    } catch (error) {
        console.error(`Error fetching products: ${error.message}`);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

const updateProduct = async (req, res) => {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ message: 'Invalid product ID' });
    }

    const { title, sku, description, category, price, stock, images, isActive } = req.body;

    const errMsg = requireFields(req.body, ['title', 'category', 'price', 'stock']);
    if (errMsg) return res.status(400).json({ message: errMsg });

    try {
        const product = await Product.findByIdAndUpdate(id, { title, sku, description, category, price, stock, images, isActive });
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        return res.status(200).json(product);
    } catch (error) {
        console.error(`Error updating product: ${error.message}`);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

const deleteProduct = async (req, res) => {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ message: 'Invalid product ID' });
    }

    try {
        const product = await Product.findByIdAndDelete(id);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        return res.status(204).send();
    } catch (error) {
        console.error(`Error deleting product: ${error.message}`);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

module.exports = {
    createProduct,
    getProduct,
    getAllProducts,
    updateProduct,
    deleteProduct
};
