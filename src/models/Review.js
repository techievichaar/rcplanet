const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5
    },
    title: {
        type: String,
        trim: true
    },
    comment: {
        type: String,
        required: true,
        trim: true
    },
    images: [{
        url: String,
        alt: String
    }],
    likes: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    verifiedPurchase: {
        type: Boolean,
        default: false
    },
    helpfulVotes: {
        type: Number,
        default: 0
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
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

// Virtual for getting review author
reviewSchema.virtual('author', {
    ref: 'User',
    localField: 'user',
    foreignField: '_id',
    justOne: true
});

// Virtual for getting reviewed product
reviewSchema.virtual('reviewedProduct', {
    ref: 'Product',
    localField: 'product',
    foreignField: '_id',
    justOne: true
});

// Method to update helpful votes
reviewSchema.methods.updateHelpfulVotes = async function(userId) {
    const index = this.likes.indexOf(userId);
    
    if (index === -1) {
        this.likes.push(userId);
        this.helpfulVotes += 1;
    } else {
        this.likes.splice(index, 1);
        this.helpfulVotes -= 1;
    }
    
    await this.save();
    return this;
};

// Method to check if user has liked the review
reviewSchema.methods.hasLiked = function(userId) {
    return this.likes.includes(userId);
};

// Method to verify purchase
reviewSchema.methods.verifyPurchase = async function() {
    const Order = mongoose.model('Order');
    
    const order = await Order.findOne({
        user: this.user,
        'items.product': this.product,
        orderStatus: 'completed'
    });
    
    this.verifiedPurchase = !!order;
    await this.save();
    return this;
};

// Update timestamps before saving
reviewSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// Update product ratings after review is saved
reviewSchema.post('save', async function() {
    const Product = mongoose.model('Product');
    const product = await Product.findById(this.product);
    if (product) {
        await product.updateRatings();
    }
});

// Update product ratings after review is removed
reviewSchema.post('remove', async function() {
    const Product = mongoose.model('Product');
    const product = await Product.findById(this.product);
    if (product) {
        await product.updateRatings();
    }
});

// Indexes
reviewSchema.index({ product: 1 });
reviewSchema.index({ user: 1 });
reviewSchema.index({ rating: 1 });
reviewSchema.index({ createdAt: -1 });
reviewSchema.index({ helpfulVotes: -1 });
reviewSchema.index({ status: 1 });

const Review = mongoose.model('Review', reviewSchema);

module.exports = Review; 