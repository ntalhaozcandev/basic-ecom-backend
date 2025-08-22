function requireFields(body, fields = []) {
    const missing = fields.filter(f => !body || body[f] == null || body[f] === '');
    if (missing.length) {
        return `Missing field(s): ${missing.join(', ')}`;
    }
    return null;
};

module.exports = {
    requireFields
};
