const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
    register,
    getUser,
    login,
    updateUser,
    deleteUser
} = require('../controllers/userController');

router.post('/users', register);
router.get('/users/:id', authenticate, getUser);
router.post('/users/login', login);
router.put('/users/:id', authenticate, updateUser);
router.delete('/users/:id', authenticate, deleteUser);

module.exports = router;
