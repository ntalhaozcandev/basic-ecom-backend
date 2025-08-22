const User = require('../models/User');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { requireFields } = require('../utils/util');
const { ObjectId } = require('mongoose').Types;

const register = async (req, res) => {
    const { email, password } = req.body;

    const errMsg = requireFields(req.body, ['email', 'password']);
    if (errMsg) return res.status(400).json({ message: errMsg });

    try {
        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).json({ message: 'User already exists' });

        const hashedPass = await bcrypt.hash(password, 10);

        const user = await User.create({ email, password: hashedPass });
        await user.validate();
        await user.save();

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

        res.status(201).json({
            token,
            user: {
                id: user._id,
                email: user.email
            }
        });
        
    } catch (error) {
        console.error(`Error creating user: ${error.message}`);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

const login = async (req, res) => {
    const { email, password } = req.body;

    const errMsg = requireFields(req.body, ['email', 'password']);
    if (errMsg) return res.status(400).json({ message: errMsg });

    try {
        const user = await User.findOne({ email });
        if(!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }
        
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

        res.status(200).json({token, user: { id: user._id }});
    } catch (error) {
        console.error(`Error logging in user: ${error.message}`);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

const getUser = async (req, res) => {
    const { id } = req.params;
    
    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ message: 'Invalid user ID' });
    }

    try {
        const user = await User.findById(id).select('-password');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.status(200).json({ user });
    } catch (error) {
        console.error(`Error fetching user: ${error.message}`);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

const updateUser = async (req, res) => {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ message: 'Invalid user ID' });
    }

    const { email, password } = req.body;

    const errMsg = requireFields(req.body, ['email', 'password']);
    if (errMsg) return res.status(400).json({ message: errMsg });

    const hashedPass = await bcrypt.hash(password, 10);

    try {
        const user = await User.findOneAndUpdate({ _id: id }, { $set: { email, password: hashedPass } });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.status(200).send();
    } catch (error) {
        console.error(`Error updating user: ${error.message}`);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

const deleteUser = async (req, res) => {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ message: 'Invalid user ID' });
    }

    try {
        const user = await User.findByIdAndDelete(id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.status(204).send();
    } catch (error) {
        console.error(`Error deleting user: ${error.message}`);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

module.exports = {
    register,
    getUser,
    login,
    updateUser,
    deleteUser
};