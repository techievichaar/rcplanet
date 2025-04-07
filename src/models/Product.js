const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    slug: {
        type: String,
        required: true,
        unique: true,
        lowercase: true
    },
    description: {
        type: String,
        required: true,
        trim: true
    },
    brand: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Brand',
        required: true
    },
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        required: true
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    comparePrice: {
        type: Number,
        min: 0
    },
    cost: {
        type: Number,
        min: 0
    },
    sku: {
        type: String,
        unique: true,
        sparse: true
    },
    barcode: {
        type: String,
        unique: true,
        sparse: true
    },
    stock: {
        type: Number,
        required: true,
        min: 0,
        default: 0
    },
    weight: {
        value: Number,
        unit: {
            type: String,
            enum: ['g', 'kg', 'lb', 'oz'],
            default: 'g'
        }
    },
    dimensions: {
        length: Number,
        width: Number,
        height: Number,
        unit: {
            type: String,
            enum: ['mm', 'cm', 'in'],
            default: 'mm'
        }
    },
    images: [{
        url: String,
        alt: String,
        isPrimary: Boolean
    }],
    videos: [{
        url: String,
        title: String,
        thumbnail: String
    }],
    features: [{
        title: String,
        description: String
    }],
    specifications: [{
        name: String,
        value: String
    }],
    attributes: [{
        name: String,
        value: String
    }],
    variants: [{
        name: String,
        options: [{
            name: String,
            price: Number,
            stock: Number,
            sku: String
        }]
    }],
    ratings: {
        average: {
            type: Number,
            default: 0,
            min: 0,
            max: 5
        },
        count: {
            type: Number,
            default: 0
        },
        distribution: {
            1: { type: Number, default: 0 },
            2: { type: Number, default: 0 },
            3: { type: Number, default: 0 },
            4: { type: Number, default: 0 },
            5: { type: Number, default: 0 }
        }
    },
    stats: {
        views: {
            type: Number,
            default: 0
        },
        sales: {
            type: Number,
            default: 0
        },
        revenue: {
            type: Number,
            default: 0
        }
    },
    meta: {
        title: String,
        description: String,
        keywords: [String]
    },
    featured: {
        type: Boolean,
        default: false
    },
    isActive: {
        type: Boolean,
        default: true
    },
    requiresShipping: {
        type: Boolean,
        default: true
    },
    isDigital: {
        type: Boolean,
        default: false
    },
    digitalFile: {
        url: String,
        name: String,
        size: Number
    },
    warranty: {
        duration: Number,
        unit: {
            type: String,
            enum: ['days', 'months', 'years'],
            default: 'months'
        },
        description: String
    },
    tags: [String],
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Virtual for getting all reviews
productSchema.virtual('reviews', {
    ref: 'Review',
    localField: '_id',
    foreignField: 'product',
    justOne: false
});

// Method to update product ratings
productSchema.methods.updateRatings = async function() {
    const Review = mongoose.model('Review');
    const reviews = await Review.find({ product: this._id });
    
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let totalRating = 0;
    
    reviews.forEach(review => {
        distribution[review.rating]++;
        totalRating += review.rating;
    });
    
    this.ratings = {
        average: reviews.length > 0 ? totalRating / reviews.length : 0,
        count: reviews.length,
        distribution
    };
    
    await this.save();
    return this;
};

// Method to update product stats
productSchema.methods.updateStats = async function() {
    const Order = mongoose.model('Order');
    
    const orders = await Order.find({
        'items.product': this._id,
        'orderStatus': 'completed'
    });
    
    let sales = 0;
    let revenue = 0;
    
    orders.forEach(order => {
        const item = order.items.find(item => item.product.equals(this._id));
        if (item) {
            sales += item.quantity;
            revenue += item.price * item.quantity;
        }
    });
    
    this.stats = {
        ...this.stats,
        sales,
        revenue
    };
    
    await this.save();
    return this;
};

// Method to check stock availability
productSchema.methods.checkStock = function(quantity = 1) {
    return this.stock >= quantity;
};

// Method to update stock
productSchema.methods.updateStock = async function(quantity) {
    if (this.stock + quantity < 0) {
        throw new Error('Insufficient stock');
    }
    
    this.stock += quantity;
    await this.save();
    return this;
};

// Method to get related products
productSchema.methods.getRelatedProducts = async function(limit = 4) {
    return await Product.find({
        _id: { $ne: this._id },
        category: this.category,
        isActive: true
    })
    .limit(limit)
    .select('name slug price images ratings');
};

// Update timestamps before saving
productSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    
    // Generate slug from name if not provided
    if (!this.slug) {
        this.slug = this.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    }
    
    // Calculate compare price if not provided
    if (!this.comparePrice) {
        this.comparePrice = this.price * 1.2; // 20% markup
    }
    
    next();
});

// Update ratings after saving
productSchema.post('save', async function() {
    await this.updateRatings();
});

// Indexes
productSchema.index({ slug: 1 });
productSchema.index({ name: 1 });
productSchema.index({ brand: 1 });
productSchema.index({ category: 1 });
productSchema.index({ price: 1 });
productSchema.index({ 'ratings.average': 1 });
productSchema.index({ 'stats.sales': 1 });
productSchema.index({ featured: 1 });
productSchema.index({ isActive: 1 });
productSchema.index({ tags: 1 });
productSchema.index({ createdAt: -1 });

const Product = mongoose.model('Product', productSchema);

module.exports = Product; 
module.exports = Product; 