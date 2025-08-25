const express = require('express');
const router = express.Router();
const { authenticate, adminOnly } = require('../middleware/auth');
const {
    register,
    getUser,
    login,
    updateUser,
    deleteUser,
    getAllUsers
} = require('../controllers/userController');

router.post('/users', register);
router.get('/users/:id', authenticate, getUser);
router.get('/users', authenticate, adminOnly, getAllUsers);
router.post('/users/login', login);
router.put('/users/:id', authenticate, updateUser);
router.delete('/users/:id', authenticate, deleteUser);

module.exports = router;
