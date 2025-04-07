const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const { auth, adminAuth } = require('../middleware/auth');
const Coupon = require('../models/Coupon');
const Order = require('../models/Order');
const { AppError } = require('../middleware/error');
const logger = require('../utils/logger');

// Validation middleware
const validateCoupon = [
  body('code').notEmpty().withMessage('Code is required'),
  body('type').isIn(['percentage', 'fixed']).withMessage('Invalid coupon type'),
  body('value').isFloat({ min: 0 }).withMessage('Value must be a positive number'),
  body('startDate').isISO8601().withMessage('Invalid start date'),
  body('endDate').isISO8601().withMessage('Invalid end date'),
  body('minPurchase').optional().isFloat({ min: 0 }).withMessage('Minimum purchase must be a positive number'),
  body('maxDiscount').optional().isFloat({ min: 0 }).withMessage('Maximum discount must be a positive number'),
  body('usageLimit').optional().isInt({ min: 1 }).withMessage('Usage limit must be a positive integer'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean')
];

// Get all coupons (admin only)
router.get('/', adminAuth, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const coupons = await Coupon.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Coupon.countDocuments();

    res.json({
      status: 'success',
      data: {
        coupons,
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

// Get active coupons
router.get('/active', async (req, res, next) => {
  try {
    const coupons = await Coupon.find({
      isActive: true,
      startDate: { $lte: new Date() },
      endDate: { $gte: new Date() }
    }).sort({ createdAt: -1 });

    res.json({
      status: 'success',
      data: { coupons }
    });
  } catch (error) {
    next(error);
  }
});

// Get coupon by ID (admin only)
router.get('/:id', adminAuth, [
  param('id').isMongoId().withMessage('Invalid coupon ID')
], async (req, res, next) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) {
      throw new AppError('Coupon not found', 404);
    }

    res.json({
      status: 'success',
      data: { coupon }
    });
  } catch (error) {
    next(error);
  }
});

// Create coupon (admin only)
router.post('/', adminAuth, validateCoupon, async (req, res, next) => {
  try {
    const {
      code,
      type,
      value,
      startDate,
      endDate,
      minPurchase,
      maxDiscount,
      usageLimit,
      isActive
    } = req.body;

    // Check if coupon code already exists
    const existingCoupon = await Coupon.findOne({ code });
    if (existingCoupon) {
      throw new AppError('Coupon code already exists', 400);
    }

    // Check if dates are valid
    if (new Date(startDate) >= new Date(endDate)) {
      throw new AppError('End date must be after start date', 400);
    }

    const coupon = new Coupon({
      code,
      type,
      value,
      startDate,
      endDate,
      minPurchase,
      maxDiscount,
      usageLimit,
      isActive
    });

    await coupon.save();

    logger.info(`Coupon created: ${coupon.code}`);

    res.status(201).json({
      status: 'success',
      message: 'Coupon created successfully',
      data: { coupon }
    });
  } catch (error) {
    next(error);
  }
});

// Update coupon (admin only)
router.put('/:id', adminAuth, validateCoupon, async (req, res, next) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) {
      throw new AppError('Coupon not found', 404);
    }

    const {
      code,
      type,
      value,
      startDate,
      endDate,
      minPurchase,
      maxDiscount,
      usageLimit,
      isActive
    } = req.body;

    // Check if new code already exists
    if (code !== coupon.code) {
      const existingCoupon = await Coupon.findOne({ code });
      if (existingCoupon) {
        throw new AppError('Coupon code already exists', 400);
      }
    }

    // Check if dates are valid
    if (new Date(startDate) >= new Date(endDate)) {
      throw new AppError('End date must be after start date', 400);
    }

    // Update coupon
    coupon.code = code;
    coupon.type = type;
    coupon.value = value;
    coupon.startDate = startDate;
    coupon.endDate = endDate;
    coupon.minPurchase = minPurchase;
    coupon.maxDiscount = maxDiscount;
    coupon.usageLimit = usageLimit;
    coupon.isActive = isActive;

    await coupon.save();

    logger.info(`Coupon updated: ${coupon.code}`);

    res.json({
      status: 'success',
      message: 'Coupon updated successfully',
      data: { coupon }
    });
  } catch (error) {
    next(error);
  }
});

// Delete coupon (admin only)
router.delete('/:id', adminAuth, async (req, res, next) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) {
      throw new AppError('Coupon not found', 404);
    }

    // Check if coupon has been used
    const hasBeenUsed = await Order.exists({ coupon: coupon.code });
    if (hasBeenUsed) {
      throw new AppError('Cannot delete coupon that has been used', 400);
    }

    await coupon.remove();

    logger.info(`Coupon deleted: ${coupon.code}`);

    res.json({
      status: 'success',
      message: 'Coupon deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

// Validate coupon
router.post('/validate', auth, [
  body('code').notEmpty().withMessage('Code is required'),
  body('amount').isFloat({ min: 0 }).withMessage('Amount must be a positive number')
], async (req, res, next) => {
  try {
    const { code, amount } = req.body;
    const user = req.user;

    // Get coupon
    const coupon = await Coupon.findOne({
      code,
      isActive: true,
      startDate: { $lte: new Date() },
      endDate: { $gte: new Date() }
    });

    if (!coupon) {
      throw new AppError('Invalid or expired coupon', 400);
    }

    // Check minimum purchase
    if (coupon.minPurchase && amount < coupon.minPurchase) {
      throw new AppError(
        `Minimum purchase of ${coupon.minPurchase} required for this coupon`,
        400
      );
    }

    // Check usage limit
    if (coupon.usageLimit) {
      const usageCount = await Order.countDocuments({
        user: user._id,
        coupon: coupon.code
      });

      if (usageCount >= coupon.usageLimit) {
        throw new AppError('Coupon usage limit reached', 400);
      }
    }

    // Calculate discount
    let discount = coupon.type === 'percentage'
      ? (amount * coupon.value) / 100
      : coupon.value;

    // Check maximum discount
    if (coupon.maxDiscount && discount > coupon.maxDiscount) {
      discount = coupon.maxDiscount;
    }

    res.json({
      status: 'success',
      data: {
        valid: true,
        discount,
        coupon: {
          code: coupon.code,
          type: coupon.type,
          value: coupon.value
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get coupon usage statistics (admin only)
router.get('/:id/stats', adminAuth, async (req, res, next) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) {
      throw new AppError('Coupon not found', 404);
    }

    const stats = await Order.aggregate([
      { $match: { coupon: coupon.code } },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalDiscount: { $sum: '$discount' },
          averageOrderValue: { $avg: '$total' }
        }
      }
    ]);

    res.json({
      status: 'success',
      data: {
        coupon: coupon.code,
        stats: stats[0] || {
          totalOrders: 0,
          totalDiscount: 0,
          averageOrderValue: 0
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router; 