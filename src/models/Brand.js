const mongoose = require('mongoose');

const brandSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        unique: true
    },
    slug: {
        type: String,
        required: true,
        unique: true,
        lowercase: true
    },
    description: {
        type: String,
        trim: true
    },
    logo: {
        url: String,
        alt: String
    },
    banner: {
        url: String,
        alt: String
    },
    website: {
        type: String,
        trim: true
    },
    socialMedia: {
        facebook: String,
        twitter: String,
        instagram: String,
        youtube: String
    },
    categories: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category'
    }],
    featured: {
        type: Boolean,
        default: false
    },
    isActive: {
        type: Boolean,
        default: true
    },
    order: {
        type: Number,
        default: 0
    },
    meta: {
        title: String,
        description: String,
        keywords: [String]
    },
    stats: {
        productCount: {
            type: Number,
            default: 0
        },
        averageRating: {
            type: Number,
            default: 0
        },
        reviewCount: {
            type: Number,
            default: 0
        }
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

// Virtual for getting all products
brandSchema.virtual('products', {
    ref: 'Product',
    localField: '_id',
    foreignField: 'brand',
    justOne: false
});

// Virtual for getting all reviews
brandSchema.virtual('reviews', {
    ref: 'Review',
    localField: '_id',
    foreignField: 'product.brand',
    justOne: false
});

// Method to update brand stats
brandSchema.methods.updateStats = async function() {
    const Product = mongoose.model('Product');
    const Review = mongoose.model('Review');

    // Get product count
    const productCount = await Product.countDocuments({ brand: this._id });

    // Get review stats
    const reviews = await Review.find({ 'product.brand': this._id });
    const reviewCount = reviews.length;
    const averageRating = reviewCount > 0
        ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviewCount
        : 0;

    this.stats = {
        productCount,
        averageRating,
        reviewCount
    };

    await this.save();
    return this;
};

// Method to get featured products
brandSchema.methods.getFeaturedProducts = async function(limit = 4) {
    const Product = mongoose.model('Product');
    return await Product.find({
        brand: this._id,
        featured: true
    }).limit(limit);
};

// Method to get new arrivals
brandSchema.methods.getNewArrivals = async function(limit = 4) {
    const Product = mongoose.model('Product');
    return await Product.find({
        brand: this._id
    })
    .sort({ createdAt: -1 })
    .limit(limit);
};

// Method to get best sellers
brandSchema.methods.getBestSellers = async function(limit = 4) {
    const Product = mongoose.model('Product');
    return await Product.find({
        brand: this._id
    })
    .sort({ 'stats.sales': -1 })
    .limit(limit);
};

// Method to get top rated products
brandSchema.methods.getTopRated = async function(limit = 4) {
    const Product = mongoose.model('Product');
    return await Product.find({
        brand: this._id
    })
    .sort({ 'ratings.average': -1 })
    .limit(limit);
};

// Update timestamps before saving
brandSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    
    // Generate slug from name if not provided
    if (!this.slug) {
        this.slug = this.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    }
    
    next();
});

// Update stats after saving
brandSchema.post('save', async function() {
    await this.updateStats();
});

// Indexes
brandSchema.index({ slug: 1 });
brandSchema.index({ name: 1 });
brandSchema.index({ isActive: 1 });
brandSchema.index({ featured: 1 });
brandSchema.index({ order: 1 });
brandSchema.index({ 'stats.productCount': 1 });
brandSchema.index({ 'stats.averageRating': 1 });

const Brand = mongoose.model('Brand', brandSchema);

module.exports = Brand; 