const mongoose = require('mongoose');

const cartSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    items: [{
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            required: true
        },
        quantity: {
            type: Number,
            required: true,
            min: 1
        },
        price: {
            type: Number,
            required: true
        },
        variant: {
            name: String,
            option: String
        },
        addedAt: {
            type: Date,
            default: Date.now
        }
    }],
    coupon: {
        code: String,
        discount: {
            type: Number,
            default: 0
        },
        type: {
            type: String,
            enum: ['percentage', 'fixed'],
            default: 'percentage'
        }
    },
    shipping: {
        method: String,
        cost: {
            type: Number,
            default: 0
        },
        address: {
            street: String,
            city: String,
            state: String,
            country: String,
            zipCode: String
        }
    },
    tax: {
        rate: {
            type: Number,
            default: 0
        },
        amount: {
            type: Number,
            default: 0
        }
    },
    subtotal: {
        type: Number,
        default: 0
    },
    total: {
        type: Number,
        default: 0
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

// Virtual for getting cart item count
cartSchema.virtual('itemCount').get(function() {
    return this.items.reduce((total, item) => total + item.quantity, 0);
});

// Method to add item to cart
cartSchema.methods.addItem = async function(productId, quantity, variant = null) {
    const Product = mongoose.model('Product');
    const product = await Product.findById(productId);
    
    if (!product) {
        throw new Error('Product not found');
    }
    
    if (!product.checkStock(quantity)) {
        throw new Error('Insufficient stock');
    }
    
    const existingItem = this.items.find(item => 
        item.product.equals(productId) && 
        (!variant || (item.variant.name === variant.name && item.variant.option === variant.option))
    );
    
    if (existingItem) {
        existingItem.quantity += quantity;
        existingItem.price = product.price;
    } else {
        this.items.push({
            product: productId,
            quantity,
            price: product.price,
            variant
        });
    }
    
    await this.calculateTotals();
    return this;
};

// Method to update item quantity
cartSchema.methods.updateItemQuantity = async function(productId, quantity, variant = null) {
    const Product = mongoose.model('Product');
    const product = await Product.findById(productId);
    
    if (!product) {
        throw new Error('Product not found');
    }
    
    if (!product.checkStock(quantity)) {
        throw new Error('Insufficient stock');
    }
    
    const item = this.items.find(item => 
        item.product.equals(productId) && 
        (!variant || (item.variant.name === variant.name && item.variant.option === variant.option))
    );
    
    if (!item) {
        throw new Error('Item not found in cart');
    }
    
    item.quantity = quantity;
    item.price = product.price;
    
    await this.calculateTotals();
    return this;
};

// Method to remove item from cart
cartSchema.methods.removeItem = async function(productId, variant = null) {
    this.items = this.items.filter(item => 
        !item.product.equals(productId) || 
        (variant && (item.variant.name !== variant.name || item.variant.option !== variant.option))
    );
    
    await this.calculateTotals();
    return this;
};

// Method to clear cart
cartSchema.methods.clearCart = async function() {
    this.items = [];
    this.coupon = null;
    this.shipping = {
        method: null,
        cost: 0,
        address: null
    };
    this.tax = {
        rate: 0,
        amount: 0
    };
    this.subtotal = 0;
    this.total = 0;
    
    await this.save();
    return this;
};

// Method to apply coupon
cartSchema.methods.applyCoupon = async function(coupon) {
    this.coupon = {
        code: coupon.code,
        discount: coupon.discount,
        type: coupon.type
    };
    
    await this.calculateTotals();
    return this;
};

// Method to remove coupon
cartSchema.methods.removeCoupon = async function() {
    this.coupon = null;
    await this.calculateTotals();
    return this;
};

// Method to update shipping
cartSchema.methods.updateShipping = async function(method, cost, address = null) {
    this.shipping = {
        method,
        cost,
        address
    };
    
    await this.calculateTotals();
    return this;
};

// Method to calculate totals
cartSchema.methods.calculateTotals = async function() {
    // Calculate subtotal
    this.subtotal = this.items.reduce((total, item) => 
        total + (item.price * item.quantity), 0
    );
    
    // Apply coupon discount
    let discount = 0;
    if (this.coupon) {
        if (this.coupon.type === 'percentage') {
            discount = (this.subtotal * this.coupon.discount) / 100;
        } else {
            discount = this.coupon.discount;
        }
    }
    
    // Calculate tax
    this.tax.amount = (this.subtotal - discount) * (this.tax.rate / 100);
    
    // Calculate total
    this.total = this.subtotal - discount + this.tax.amount + this.shipping.cost;
    
    await this.save();
    return this;
};

// Update timestamps before saving
cartSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// Indexes
cartSchema.index({ user: 1 });
cartSchema.index({ 'items.product': 1 });
cartSchema.index({ createdAt: -1 });

const Cart = mongoose.model('Cart', cartSchema);

module.exports = Cart; 