const Review = require('../models/Review');
const Product = require('../models/Product');
const User = require('../models/User');
const Order = require('../models/Order');

// Create a new review
exports.createReview = async (req, res) => {
    try {
        const { productId } = req.params;
        const { rating, title, comment, images } = req.body;
        const userId = req.user._id;

        // Check if product exists
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        // Check if user has already reviewed this product
        const existingReview = await Review.findOne({
            user: userId,
            product: productId
        });

        if (existingReview) {
            return res.status(400).json({ 
                error: 'You have already reviewed this product' 
            });
        }

        // Create new review
        const review = new Review({
            user: userId,
            product: productId,
            rating,
            title,
            comment,
            images
        });

        // Verify purchase if applicable
        await review.verifyPurchase();
        await review.save();

        res.status(201).json(review);
    } catch (error) {
        res.status(400).json({ error: 'Error creating review' });
    }
};

// Get all reviews for a product
exports.getProductReviews = async (req, res) => {
    try {
        const { productId } = req.params;
        const { 
            page = 1, 
            limit = 10,
            rating,
            verified,
            sort = 'createdAt',
            order = 'desc'
        } = req.query;

        const query = { product: productId };

        if (rating) query.rating = parseInt(rating);
        if (verified !== undefined) query.verifiedPurchase = verified === 'true';

        const reviews = await Review.find(query)
            .sort({ [sort]: order === 'desc' ? -1 : 1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit))
            .populate('user', 'name avatar')
            .populate('product', 'name slug');

        const total = await Review.countDocuments(query);

        res.json({
            reviews,
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / limit),
            totalReviews: total
        });
    } catch (error) {
        res.status(500).json({ error: 'Error fetching reviews' });
    }
};

// Get a single review
exports.getReview = async (req, res) => {
    try {
        const { id } = req.params;
        const review = await Review.findById(id)
            .populate('user', 'name avatar')
            .populate('product', 'name slug');

        if (!review) {
            return res.status(404).json({ error: 'Review not found' });
        }

        res.json(review);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching review' });
    }
};

// Update a review
exports.updateReview = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;

        const review = await Review.findById(id);
        if (!review) {
            return res.status(404).json({ error: 'Review not found' });
        }

        // Check if user is the author
        if (!review.user.equals(userId)) {
            return res.status(403).json({ 
                error: 'You are not authorized to update this review' 
            });
        }

        const updatedReview = await Review.findByIdAndUpdate(
            id,
            req.body,
            { new: true, runValidators: true }
        );

        res.json(updatedReview);
    } catch (error) {
        res.status(400).json({ error: 'Error updating review' });
    }
};

// Delete a review
exports.deleteReview = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;

        const review = await Review.findById(id);
        if (!review) {
            return res.status(404).json({ error: 'Review not found' });
        }

        // Check if user is the author
        if (!review.user.equals(userId)) {
            return res.status(403).json({ 
                error: 'You are not authorized to delete this review' 
            });
        }

        await review.remove();
        res.json({ message: 'Review deleted successfully' });
    } catch (error) {
        res.status(400).json({ error: 'Error deleting review' });
    }
};

// Update review status (admin only)
exports.updateReviewStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const review = await Review.findByIdAndUpdate(
            id,
            { status },
            { new: true, runValidators: true }
        );

        if (!review) {
            return res.status(404).json({ error: 'Review not found' });
        }

        res.json(review);
    } catch (error) {
        res.status(400).json({ error: 'Error updating review status' });
    }
};

// Toggle review helpful vote
exports.toggleHelpfulVote = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;

        const review = await Review.findById(id);
        if (!review) {
            return res.status(404).json({ error: 'Review not found' });
        }

        await review.updateHelpfulVotes(userId);
        res.json(review);
    } catch (error) {
        res.status(400).json({ error: 'Error updating helpful votes' });
    }
};

// Get user's reviews
exports.getUserReviews = async (req, res) => {
    try {
        const userId = req.user._id;
        const { 
            page = 1, 
            limit = 10,
            sort = 'createdAt',
            order = 'desc'
        } = req.query;

        const reviews = await Review.find({ user: userId })
            .sort({ [sort]: order === 'desc' ? -1 : 1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit))
            .populate('product', 'name slug images');

        const total = await Review.countDocuments({ user: userId });

        res.json({
            reviews,
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / limit),
            totalReviews: total
        });
    } catch (error) {
        res.status(500).json({ error: 'Error fetching user reviews' });
    }
};

// Get recent reviews
exports.getRecentReviews = async (req, res) => {
    try {
        const { limit = 10 } = req.query;
        const reviews = await Review.find({ status: 'approved' })
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .populate('user', 'name avatar')
            .populate('product', 'name slug images');

        res.json(reviews);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching recent reviews' });
    }
};

// Helper function to check if user has purchased the product
async function checkVerifiedPurchase(userId, productId) {
    const order = await Order.findOne({
        user: userId,
        'items.product': productId,
        orderStatus: 'delivered'
    });
    return !!order;
}

// Helper function to update product's average rating
async function updateProductRating(productId) {
    const reviews = await Review.find({ product: productId });
    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    const averageRating = reviews.length > 0 ? totalRating / reviews.length : 0;

    await Product.findByIdAndUpdate(productId, {
        'ratings.average': averageRating,
        'ratings.count': reviews.length
    });
} 