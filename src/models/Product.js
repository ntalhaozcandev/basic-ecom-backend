const mongoose = require('mongoose');

const productSchema = mongoose.Schema({
    title: { type: String, required: true, unique: true, trim: true },
    slug: { type: String, required: true, unique: true, index: true },
    sku: { type: String, unique: true, sparse: true, trim: true },
    description: { type: String, trim: true },
    price: { type: Number, required: true, min: 0 },
    stock: { type: Number, required: true, min: 0 },
    images: [{ type: String }],
    isActive: { type: Boolean, default: true }
},
{
    timestamps: true
});

productSchema.index({ title: 'text', description: 'text' });

productSchema.virtual('inStock').get(function() {
    return this.isActive && this.stock > 0;
});

productSchema.pre('validate', function(next){
    if (!this.slug || this.isModified('title') || this.isNew) {
        if (this.title) {
            this.slug = this.title
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/(^-|-$)/g, '')
                .slice(0,60);
        }
    };

    next();
});

module.exports = mongoose.model('Product', productSchema);