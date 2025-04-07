const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    orderNumber: {
        type: String,
        required: true,
        unique: true
    },
    items: [{
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            required: true
        },
        name: {
            type: String,
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
        total: {
            type: Number,
            required: true
        }
    }],
    subtotal: {
        type: Number,
        required: true
    },
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
        method: {
            type: String,
            required: true
        },
        cost: {
            type: Number,
            required: true
        },
        address: {
            street: {
                type: String,
                required: true
            },
            city: {
                type: String,
                required: true
            },
            state: {
                type: String,
                required: true
            },
            country: {
                type: String,
                required: true
            },
            zipCode: {
                type: String,
                required: true
            }
        },
        tracking: {
            carrier: String,
            number: String,
            url: String,
            status: String,
            updates: [{
                status: String,
                location: String,
                date: Date,
                description: String
            }]
        }
    },
    tax: {
        rate: {
            type: Number,
            required: true
        },
        amount: {
            type: Number,
            required: true
        }
    },
    total: {
        type: Number,
        required: true
    },
    payment: {
        method: {
            type: String,
            required: true,
            enum: ['credit_card', 'paypal', 'stripe', 'bank_transfer']
        },
        status: {
            type: String,
            required: true,
            enum: ['pending', 'processing', 'completed', 'failed', 'refunded'],
            default: 'pending'
        },
        transactionId: String,
        amount: {
            type: Number,
            required: true
        },
        currency: {
            type: String,
            default: 'USD'
        },
        details: {
            card: {
                last4: String,
                brand: String,
                expMonth: Number,
                expYear: Number
            },
            paypal: {
                email: String,
                payerId: String
            },
            bank: {
                accountNumber: String,
                routingNumber: String,
                accountType: String
            }
        }
    },
    status: {
        type: String,
        required: true,
        enum: [
            'pending',
            'processing',
            'shipped',
            'delivered',
            'cancelled',
            'refunded',
            'failed'
        ],
        default: 'pending'
    },
    notes: {
        customer: String,
        admin: String
    },
    metadata: {
        ip: String,
        userAgent: String,
        referrer: String
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

// Virtual for getting order status history
orderSchema.virtual('statusHistory', {
    ref: 'OrderStatus',
    localField: '_id',
    foreignField: 'order',
    justOne: false
});

// Method to update order status
orderSchema.methods.updateStatus = async function(status, notes = '') {
    const OrderStatus = mongoose.model('OrderStatus');
    
    this.status = status;
    if (notes) {
        this.notes.admin = notes;
    }
    
    await this.save();
    
    // Create status history entry
    await OrderStatus.create({
        order: this._id,
        status,
        notes
    });
    
    return this;
};

// Method to update payment status
orderSchema.methods.updatePaymentStatus = async function(status, transactionId = null) {
    this.payment.status = status;
    if (transactionId) {
        this.payment.transactionId = transactionId;
    }
    
    await this.save();
    return this;
};

// Method to add tracking information
orderSchema.methods.addTracking = async function(carrier, number, url) {
    this.shipping.tracking = {
        carrier,
        number,
        url,
        status: 'pending',
        updates: []
    };
    
    await this.save();
    return this;
};

// Method to update tracking status
orderSchema.methods.updateTracking = async function(status, location, description) {
    if (!this.shipping.tracking) {
        throw new Error('No tracking information available');
    }
    
    this.shipping.tracking.status = status;
    this.shipping.tracking.updates.push({
        status,
        location,
        date: new Date(),
        description
    });
    
    await this.save();
    return this;
};

// Method to process refund
orderSchema.methods.processRefund = async function(amount, reason) {
    if (this.payment.status !== 'completed') {
        throw new Error('Cannot refund an incomplete payment');
    }
    
    if (amount > this.total) {
        throw new Error('Refund amount cannot exceed order total');
    }
    
    this.payment.status = 'refunded';
    this.status = 'refunded';
    
    // Create refund record
    const Refund = mongoose.model('Refund');
    await Refund.create({
        order: this._id,
        amount,
        reason,
        status: 'completed'
    });
    
    await this.save();
    return this;
};

// Update timestamps before saving
orderSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    
    // Generate order number if not provided
    if (!this.orderNumber) {
        const timestamp = Date.now().toString();
        const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        this.orderNumber = `ORD-${timestamp}-${random}`;
    }
    
    next();
});

// Indexes
orderSchema.index({ user: 1 });
orderSchema.index({ orderNumber: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ 'payment.status': 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ 'shipping.tracking.number': 1 });

const Order = mongoose.model('Order', orderSchema);

module.exports = Order; 