function requireFields(body, fields = []) {
    const missing = fields.filter(f => !body || body[f] == null || body[f] === '');
    if (missing.length) {
        return `Missing field(s): ${missing.join(', ')}`;
    }
    return null;
};

const successResponse = (res, data, message = 'Success', statusCode = 200) => {
    return res.status(statusCode).json({
        success: true,
        message,
        data,
        timestamp: new Date().toISOString()
    });
};

const errorResponse = (res, message = 'Error', statusCode = 500, errors = null) => {
    return res.status(statusCode).json({
        success: false,
        message,
        errors,
        timestamp: new Date().toISOString()
    });
};

const generateTokens = (userId) => {
    const accessToken = jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '15m' });
    const refreshToken = jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
    return { accessToken, refreshToken };
};

module.exports = {
    requireFields,
    successResponse,
    errorResponse,
    generateTokens
};
