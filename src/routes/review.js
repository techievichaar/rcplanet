const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const { auth } = require('../middleware/auth');
const Review = require('../models/Review');
const Product = require('../models/Product');
const Order = require('../models/Order');
const { AppError } = require('../middleware/error');
const logger = require('../utils/logger');

// Validation middleware
const validateReview = [
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('title').notEmpty().withMessage('Title is required'),
  body('comment').notEmpty().withMessage('Comment is required'),
  body('images').optional().isArray().withMessage('Images must be an array')
];

// Get product reviews
router.get('/product/:productId', [
  param('productId').isMongoId().withMessage('Invalid product ID'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1 }).withMessage('Limit must be a positive integer'),
  query('sort').optional().isIn(['newest', 'highest', 'lowest'])
    .withMessage('Invalid sort option')
], async (req, res, next) => {
  try {
    const { productId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      throw new AppError('Product not found', 404);
    }

    // Build sort object
    let sort = { createdAt: -1 };
    if (req.query.sort === 'highest') {
      sort = { rating: -1 };
    } else if (req.query.sort === 'lowest') {
      sort = { rating: 1 };
    }

    const reviews = await Review.find({ product: productId })
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('user', 'firstName lastName');

    const total = await Review.countDocuments({ product: productId });

    // Calculate average rating
    const averageRating = await Review.aggregate([
      { $match: { product: product._id } },
      { $group: { _id: null, avgRating: { $avg: '$rating' } } }
    ]);

    res.json({
      status: 'success',
      data: {
        reviews,
        pagination: {
          total,
          page,
          pages: Math.ceil(total / limit)
        },
        averageRating: averageRating[0]?.avgRating || 0
      }
    });
  } catch (error) {
    next(error);
  }
});

// Create review
router.post('/', auth, validateReview, async (req, res, next) => {
  try {
    const { productId, rating, title, comment, images } = req.body;
    const user = req.user;

    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      throw new AppError('Product not found', 404);
    }

    // Check if user has purchased the product
    const hasPurchased = await Order.exists({
      user: user._id,
      'items.product': productId,
      status: 'delivered'
    });

    if (!hasPurchased) {
      throw new AppError('You must purchase the product before reviewing it', 400);
    }

    // Check if user has already reviewed the product
    const existingReview = await Review.findOne({
      user: user._id,
      product: productId
    });

    if (existingReview) {
      throw new AppError('You have already reviewed this product', 400);
    }

    // Create review
    const review = new Review({
      user: user._id,
      product: productId,
      rating,
      title,
      comment,
      images
    });

    await review.save();

    // Update product reviews and rating
    product.reviews.push(review._id);
    
    const reviews = await Review.find({ product: productId });
    const averageRating = reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;
    product.rating = averageRating;
    
    await product.save();

    logger.info(`Review created: ${review._id}`);

    res.status(201).json({
      status: 'success',
      message: 'Review created successfully',
      data: { review }
    });
  } catch (error) {
    next(error);
  }
});

// Update review
router.put('/:id', auth, validateReview, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rating, title, comment, images } = req.body;

    // Get review
    const review = await Review.findById(id);
    if (!review) {
      throw new AppError('Review not found', 404);
    }

    // Check if user is the author
    if (review.user.toString() !== req.user._id.toString()) {
      throw new AppError('Not authorized to update this review', 403);
    }

    // Update review
    review.rating = rating;
    review.title = title;
    review.comment = comment;
    review.images = images;
    await review.save();

    // Update product rating
    const product = await Product.findById(review.product);
    const reviews = await Review.find({ product: product._id });
    const averageRating = reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;
    product.rating = averageRating;
    await product.save();

    logger.info(`Review updated: ${review._id}`);

    res.json({
      status: 'success',
      message: 'Review updated successfully',
      data: { review }
    });
  } catch (error) {
    next(error);
  }
});

// Delete review
router.delete('/:id', auth, async (req, res, next) => {
  try {
    const { id } = req.params;

    // Get review
    const review = await Review.findById(id);
    if (!review) {
      throw new AppError('Review not found', 404);
    }

    // Check if user is the author
    if (review.user.toString() !== req.user._id.toString()) {
      throw new AppError('Not authorized to delete this review', 403);
    }

    // Remove review from product
    const product = await Product.findById(review.product);
    product.reviews = product.reviews.filter(
      reviewId => reviewId.toString() !== review._id.toString()
    );

    // Update product rating
    const reviews = await Review.find({ product: product._id });
    const averageRating = reviews.length > 1
      ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
      : 0;
    product.rating = averageRating;
    await product.save();

    await review.remove();

    logger.info(`Review deleted: ${id}`);

    res.json({
      status: 'success',
      message: 'Review deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

// Report review
router.post('/:id/report', auth, [
  body('reason').notEmpty().withMessage('Reason is required')
], async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    // Get review
    const review = await Review.findById(id);
    if (!review) {
      throw new AppError('Review not found', 404);
    }

    // Check if user has already reported this review
    const hasReported = review.reports.some(
      report => report.user.toString() === req.user._id.toString()
    );

    if (hasReported) {
      throw new AppError('You have already reported this review', 400);
    }

    // Add report
    review.reports.push({
      user: req.user._id,
      reason
    });

    await review.save();

    logger.info(`Review reported: ${id}`);

    res.json({
      status: 'success',
      message: 'Review reported successfully'
    });
  } catch (error) {
    next(error);
  }
});

// Like/Unlike review
router.post('/:id/like', auth, async (req, res, next) => {
  try {
    const { id } = req.params;

    // Get review
    const review = await Review.findById(id);
    if (!review) {
      throw new AppError('Review not found', 404);
    }

    // Check if user has already liked this review
    const likeIndex = review.likes.indexOf(req.user._id);
    if (likeIndex === -1) {
      review.likes.push(req.user._id);
    } else {
      review.likes.splice(likeIndex, 1);
    }

    await review.save();

    logger.info(`Review ${likeIndex === -1 ? 'liked' : 'unliked'}: ${id}`);

    res.json({
      status: 'success',
      message: `Review ${likeIndex === -1 ? 'liked' : 'unliked'} successfully`,
      data: { likes: review.likes.length }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router; 