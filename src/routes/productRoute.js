const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
    createProduct,
    getProduct,
    getAllProducts,
    updateProduct,
    deleteProduct
} = require('../controllers/productController');

router.post('/products', authenticate, createProduct);
router.get('/products/:id', getProduct);
router.get('/products', getAllProducts);
router.put('/products/:id', authenticate, updateProduct);
router.delete('/products/:id', authenticate, deleteProduct);

module.exports = router;
