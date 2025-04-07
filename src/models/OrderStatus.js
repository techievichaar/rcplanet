const mongoose = require('mongoose');

const orderStatusSchema = new mongoose.Schema({
    order: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        required: true
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
        ]
    },
    notes: String,
    changedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    metadata: {
        ip: String,
        userAgent: String
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Indexes
orderStatusSchema.index({ order: 1 });
orderStatusSchema.index({ status: 1 });
orderStatusSchema.index({ createdAt: -1 });

const OrderStatus = mongoose.model('OrderStatus', orderStatusSchema);

module.exports = OrderStatus; 