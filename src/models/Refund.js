const mongoose = require('mongoose');

const refundSchema = new mongoose.Schema({
    order: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    reason: {
        type: String,
        required: true
    },
    status: {
        type: String,
        required: true,
        enum: ['pending', 'processing', 'completed', 'failed'],
        default: 'pending'
    },
    paymentMethod: {
        type: String,
        required: true,
        enum: ['credit_card', 'paypal', 'stripe', 'bank_transfer']
    },
    transactionId: String,
    processedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    notes: String,
    metadata: {
        ip: String,
        userAgent: String
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

// Update timestamps before saving
refundSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// Indexes
refundSchema.index({ order: 1 });
refundSchema.index({ status: 1 });
refundSchema.index({ createdAt: -1 });
refundSchema.index({ transactionId: 1 });

const Refund = mongoose.model('Refund', refundSchema);

module.exports = Refund; 