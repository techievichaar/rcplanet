const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
    code: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true
    },
    type: {
        type: String,
        enum: ['percentage', 'fixed', 'free_shipping'],
        required: true
    },
    value: {
        type: Number,
        required: true,
        min: 0
    },
    minPurchase: {
        type: Number,
        default: 0
    },
    maxDiscount: {
        type: Number,
        default: null
    },
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date,
        required: true
    },
    usageLimit: {
        type: Number,
        default: null
    },
    perUserLimit: {
        type: Number,
        default: 1
    },
    categories: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category'
    }],
    products: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product'
    }],
    excludedProducts: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product'
    }],
    isActive: {
        type: Boolean,
        default: true
    },
    description: {
        type: String,
        trim: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Virtual for checking if coupon is valid
couponSchema.virtual('isValid').get(function() {
    const now = new Date();
    return (
        this.isActive &&
        now >= this.startDate &&
        now <= this.endDate &&
        (this.usageLimit === null || this.usageLimit > 0)
    );
});

// Method to calculate discount amount
couponSchema.methods.calculateDiscount = function(subtotal) {
    if (!this.isValid || subtotal < this.minPurchase) {
        return 0;
    }

    let discount = 0;

    switch (this.type) {
        case 'percentage':
            discount = subtotal * (this.value / 100);
            if (this.maxDiscount && discount > this.maxDiscount) {
                discount = this.maxDiscount;
            }
            break;
        case 'fixed':
            discount = this.value;
            break;
        case 'free_shipping':
            // This will be handled separately in the order processing
            discount = 0;
            break;
    }

    return discount;
};

// Method to check if coupon can be applied to a product
couponSchema.methods.isValidForProduct = function(productId) {
    if (this.products.length > 0) {
        return this.products.includes(productId);
    }
    if (this.excludedProducts.length > 0) {
        return !this.excludedProducts.includes(productId);
    }
    return true;
};

// Method to check if coupon can be applied to a category
couponSchema.methods.isValidForCategory = function(categoryId) {
    if (this.categories.length > 0) {
        return this.categories.includes(categoryId);
    }
    return true;
};

// Method to check if user has reached usage limit
couponSchema.methods.checkUserUsage = async function(userId) {
    if (this.perUserLimit === null) {
        return true;
    }

    const Order = mongoose.model('Order');
    const usageCount = await Order.countDocuments({
        user: userId,
        'discount.code': this.code
    });

    return usageCount < this.perUserLimit;
};

// Method to decrement usage limit
couponSchema.methods.decrementUsage = async function() {
    if (this.usageLimit !== null) {
        this.usageLimit -= 1;
        if (this.usageLimit <= 0) {
            this.isActive = false;
        }
        await this.save();
    }
};

// Update timestamps before saving
couponSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// Indexes
couponSchema.index({ code: 1 });
couponSchema.index({ startDate: 1, endDate: 1 });
couponSchema.index({ isActive: 1 });
couponSchema.index({ categories: 1 });
couponSchema.index({ products: 1 });

const Coupon = mongoose.model('Coupon', couponSchema);

module.exports = Coupon; 