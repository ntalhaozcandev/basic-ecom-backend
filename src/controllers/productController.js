const Product = require('../models/Product');
const { requireFields } = require('../utils/util');
const { ObjectId } = require('mongoose').Types;

const createProduct = async (req, res) => {
    const { title, sku, description, price, stock, images, isActive } = req.body;

    const errMsg = requireFields(req.body, ['title', 'price', 'stock']);
    if (errMsg) return res.status(400).json({ message: errMsg });
    
    try {
        const existingProduct = await Product.findOne({ title });
        if (existingProduct) {
            return res.status(400).json({ message: 'Product already exists' });
        }

        const product = new Product({ title, sku, description, price, stock, images, isActive});
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
    try {
        const products = await Product.find();
        return res.status(200).json(products);
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

    const { title, sku, description, price, stock, images, isActive } = req.body;
    
    const errMsg = requireFields(req.body, ['title', 'price', 'stock']);
    if (errMsg) return res.status(400).json({ message: errMsg });

    try {
        const product = await Product.findByIdAndUpdate(id, { title, sku, description, price, stock, images, isActive });
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
