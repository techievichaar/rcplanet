const Product = require('../models/Product');
const Review = require('../models/Review');

// Get all products with optional filtering
exports.getProducts = async (req, res) => {
    try {
        const { category, brand, minPrice, maxPrice, sort, search } = req.query;
        const query = {};

        if (category) query.category = category;
        if (brand) query.brand = brand;
        if (minPrice || maxPrice) {
            query.price = {};
            if (minPrice) query.price.$gte = Number(minPrice);
            if (maxPrice) query.price.$lte = Number(maxPrice);
        }
        if (search) {
            query.$text = { $search: search };
        }

        const sortOptions = {
            'price-asc': { price: 1 },
            'price-desc': { price: -1 },
            'rating': { 'ratings.average': -1 },
            'newest': { createdAt: -1 }
        };

        const sortBy = sortOptions[sort] || { createdAt: -1 };

        const products = await Product.find(query)
            .sort(sortBy)
            .limit(20);

        res.json(products);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching products' });
    }
};

// Get a single product by ID
exports.getProductById = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }
        res.json(product);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching product' });
    }
};

// Create a new product (admin only)
exports.createProduct = async (req, res) => {
    try {
        const product = new Product(req.body);
        await product.save();
        res.status(201).json(product);
    } catch (error) {
        res.status(400).json({ error: 'Error creating product' });
    }
};

// Update a product (admin only)
exports.updateProduct = async (req, res) => {
    try {
        const product = await Product.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }
        res.json(product);
    } catch (error) {
        res.status(400).json({ error: 'Error updating product' });
    }
};

// Delete a product (admin only)
exports.deleteProduct = async (req, res) => {
    try {
        const product = await Product.findByIdAndDelete(req.params.id);
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }
        res.json({ message: 'Product deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Error deleting product' });
    }
};

// Get featured products
exports.getFeaturedProducts = async (req, res) => {
    try {
        const products = await Product.find({ isFeatured: true })
            .limit(8)
            .sort({ createdAt: -1 });
        res.json(products);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching featured products' });
    }
};

// Get new arrivals
exports.getNewArrivals = async (req, res) => {
    try {
        const products = await Product.find({ isNew: true })
            .limit(8)
            .sort({ createdAt: -1 });
        res.json(products);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching new arrivals' });
    }
};

// Get products by category
exports.getProductsByCategory = async (req, res) => {
    try {
        const { category } = req.params;
        const products = await Product.find({ category })
            .sort({ createdAt: -1 });
        res.json(products);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching products by category' });
    }
};

// Get product reviews
exports.getProductReviews = async (req, res) => {
    try {
        const reviews = await Review.find({ product: req.params.id })
            .populate('user', 'name')
            .sort({ createdAt: -1 });
        res.json(reviews);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching product reviews' });
    }
};

// Add product review
exports.addProductReview = async (req, res) => {
    try {
        const { rating, title, comment, images } = req.body;
        const review = new Review({
            user: req.user._id,
            product: req.params.id,
            rating,
            title,
            comment,
            images,
            verifiedPurchase: true // You can implement logic to verify purchase
        });

        await review.save();

        // Update product rating
        const product = await Product.findById(req.params.id);
        await product.updateAverageRating(rating);

        res.status(201).json(review);
    } catch (error) {
        res.status(400).json({ error: 'Error adding review' });
    }
};

// Search products
exports.searchProducts = async (req, res) => {
    try {
        const { q } = req.query;
        const products = await Product.find(
            { $text: { $search: q } },
            { score: { $meta: 'textScore' } }
        )
        .sort({ score: { $meta: 'textScore' } })
        .limit(10);

        res.json(products);
    } catch (error) {
        res.status(500).json({ error: 'Error searching products' });
    }
}; 