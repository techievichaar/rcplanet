const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const { adminAuth } = require('../middleware/auth');
const User = require('../models/User');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Category = require('../models/Category');
const Review = require('../models/Review');
const { AppError } = require('../middleware/error');
const logger = require('../utils/logger');

// Validation middleware
const validateUserUpdate = [
  body('firstName').optional().notEmpty().withMessage('First name cannot be empty'),
  body('lastName').optional().notEmpty().withMessage('Last name cannot be empty'),
  body('email').optional().isEmail().withMessage('Please enter a valid email'),
  body('role').optional().isIn(['user', 'admin']).withMessage('Invalid role'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean')
];

// Get all users
router.get('/users', adminAuth, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const users = await User.find()
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await User.countDocuments();

    res.json({
      status: 'success',
      data: {
        users,
        pagination: {
          total,
          page,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get user by ID
router.get('/users/:id', adminAuth, [
  param('id').isMongoId().withMessage('Invalid user ID')
], async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      throw new AppError('User not found', 404);
    }

    res.json({
      status: 'success',
      data: { user }
    });
  } catch (error) {
    next(error);
  }
});

// Update user
router.put('/users/:id', adminAuth, validateUserUpdate, async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Check if email is being updated and if it's already taken
    if (req.body.email && req.body.email !== user.email) {
      const existingUser = await User.findOne({ email: req.body.email });
      if (existingUser) {
        throw new AppError('Email already in use', 400);
      }
    }

    const updates = Object.keys(req.body);
    updates.forEach(update => user[update] = req.body[update]);
    await user.save();

    logger.info(`User updated by admin: ${req.user.email}`);

    res.json({
      status: 'success',
      message: 'User updated successfully',
      data: { user }
    });
  } catch (error) {
    next(error);
  }
});

// Delete user
router.delete('/users/:id', adminAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Check if user has any orders
    const hasOrders = await Order.exists({ user: user._id });
    if (hasOrders) {
      throw new AppError('Cannot delete user with existing orders', 400);
    }

    await user.remove();

    logger.info(`User deleted by admin: ${req.user.email}`);

    res.json({
      status: 'success',
      message: 'User deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

// Get dashboard statistics
router.get('/dashboard', adminAuth, async (req, res, next) => {
  try {
    const [
      totalUsers,
      totalProducts,
      totalOrders,
      totalRevenue,
      recentOrders,
      topProducts
    ] = await Promise.all([
      User.countDocuments(),
      Product.countDocuments(),
      Order.countDocuments(),
      Order.aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$total' } } }
      ]),
      Order.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('user', 'firstName lastName email'),
      Product.find()
        .sort({ rating: -1 })
        .limit(5)
        .select('name price images rating')
    ]);

    res.json({
      status: 'success',
      data: {
        statistics: {
          totalUsers,
          totalProducts,
          totalOrders,
          totalRevenue: totalRevenue[0]?.total || 0
        },
        recentOrders,
        topProducts
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get sales report
router.get('/sales-report', adminAuth, [
  query('startDate').optional().isISO8601().withMessage('Invalid start date'),
  query('endDate').optional().isISO8601().withMessage('Invalid end date')
], async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const matchStage = { status: 'completed' };

    if (startDate && endDate) {
      matchStage.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const report = await Order.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: '$total' },
          averageOrderValue: { $avg: '$total' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    res.json({
      status: 'success',
      data: { report }
    });
  } catch (error) {
    next(error);
  }
});

// Get reported reviews
router.get('/reported-reviews', adminAuth, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const reviews = await Review.find({ 'reports.0': { $exists: true } })
      .sort({ 'reports.length': -1 })
      .skip(skip)
      .limit(limit)
      .populate('user', 'firstName lastName email')
      .populate('product', 'name');

    const total = await Review.countDocuments({ 'reports.0': { $exists: true } });

    res.json({
      status: 'success',
      data: {
        reviews,
        pagination: {
          total,
          page,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// Handle reported review
router.post('/reported-reviews/:id/handle', adminAuth, [
  param('id').isMongoId().withMessage('Invalid review ID'),
  body('action').isIn(['keep', 'delete']).withMessage('Invalid action'),
  body('reason').optional().notEmpty().withMessage('Reason cannot be empty')
], async (req, res, next) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) {
      throw new AppError('Review not found', 404);
    }

    if (req.body.action === 'delete') {
      const product = await Product.findById(review.product);
      
      // Remove review from product
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

      logger.info(`Review deleted by admin: ${req.user.email}`);
    } else {
      review.reports = [];
      await review.save();

      logger.info(`Review reports cleared by admin: ${req.user.email}`);
    }

    res.json({
      status: 'success',
      message: `Review ${req.body.action === 'delete' ? 'deleted' : 'kept'} successfully`
    });
  } catch (error) {
    next(error);
  }
});

// Get system logs
router.get('/logs', adminAuth, [
  query('type').optional().isIn(['error', 'info', 'warn']).withMessage('Invalid log type'),
  query('startDate').optional().isISO8601().withMessage('Invalid start date'),
  query('endDate').optional().isISO8601().withMessage('Invalid end date')
], async (req, res, next) => {
  try {
    const { type, startDate, endDate } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const filter = {};
    if (type) filter.level = type;
    if (startDate && endDate) {
      filter.timestamp = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const logs = await Log.find(filter)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Log.countDocuments(filter);

    res.json({
      status: 'success',
      data: {
        logs,
        pagination: {
          total,
          page,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router; 