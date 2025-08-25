const express = require('express');
const router = express.Router();
const { authenticate, adminOnly } = require('../middleware/auth');
const {
    createProduct,
    getProduct,
    getAllProducts,
    updateProduct,
    deleteProduct
} = require('../controllers/productController');

router.post('/products', authenticate, adminOnly, createProduct);
router.get('/products/:id', getProduct);
router.get('/products', getAllProducts);
router.put('/products/:id', authenticate, adminOnly, updateProduct);
router.delete('/products/:id', authenticate, adminOnly, deleteProduct);

module.exports = router;
