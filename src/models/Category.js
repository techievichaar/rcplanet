const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
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
    parent: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        default: null
    },
    level: {
        type: Number,
        default: 1
    },
    image: {
        url: String,
        alt: String
    },
    icon: {
        type: String,
        default: 'fa-box'
    },
    attributes: [{
        name: {
            type: String,
            required: true
        },
        type: {
            type: String,
            enum: ['text', 'number', 'boolean', 'select'],
            required: true
        },
        options: [String],
        required: {
            type: Boolean,
            default: false
        }
    }],
    filters: [{
        name: String,
        type: {
            type: String,
            enum: ['range', 'select', 'boolean']
        },
        values: [String]
    }],
    isActive: {
        type: Boolean,
        default: true
    },
    featured: {
        type: Boolean,
        default: false
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
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Virtual for getting all ancestors
categorySchema.virtual('ancestors', {
    ref: 'Category',
    localField: 'parent',
    foreignField: '_id',
    justOne: false
});

// Virtual for getting all descendants
categorySchema.virtual('descendants', {
    ref: 'Category',
    localField: '_id',
    foreignField: 'parent',
    justOne: false
});

// Virtual for getting product count
categorySchema.virtual('productCount', {
    ref: 'Product',
    localField: '_id',
    foreignField: 'category',
    count: true
});

// Method to get all parent categories
categorySchema.methods.getParents = async function() {
    const parents = [];
    let current = this;
    
    while (current.parent) {
        current = await this.model('Category').findById(current.parent);
        if (current) {
            parents.unshift(current);
        }
    }
    
    return parents;
};

// Method to get all child categories
categorySchema.methods.getChildren = async function() {
    return await this.model('Category').find({ parent: this._id });
};

// Method to get all descendant categories
categorySchema.methods.getDescendants = async function() {
    const descendants = [];
    const children = await this.getChildren();
    
    for (const child of children) {
        descendants.push(child);
        const childDescendants = await child.getDescendants();
        descendants.push(...childDescendants);
    }
    
    return descendants;
};

// Method to get breadcrumb path
categorySchema.methods.getBreadcrumb = async function() {
    const breadcrumb = [this];
    const parents = await this.getParents();
    return [...parents, ...breadcrumb];
};

// Method to check if category is a leaf (has no children)
categorySchema.methods.isLeaf = async function() {
    const children = await this.model('Category').countDocuments({ parent: this._id });
    return children === 0;
};

// Method to get category path
categorySchema.methods.getPath = async function() {
    const parents = await this.getParents();
    return [...parents.map(p => p.slug), this.slug].join('/');
};

// Update timestamps before saving
categorySchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    
    // Generate slug from name if not provided
    if (!this.slug) {
        this.slug = this.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    }
    
    // Update level based on parent
    if (this.parent) {
        this.level = this.parent.level + 1;
    } else {
        this.level = 1;
    }
    
    next();
});

// Indexes
categorySchema.index({ slug: 1 });
categorySchema.index({ parent: 1 });
categorySchema.index({ level: 1 });
categorySchema.index({ isActive: 1 });
categorySchema.index({ featured: 1 });
categorySchema.index({ order: 1 });

const Category = mongoose.model('Category', categorySchema);

module.exports = Category; 