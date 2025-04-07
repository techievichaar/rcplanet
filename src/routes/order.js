const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const { auth, adminAuth } = require('../middleware/auth');
const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const { AppError } = require('../middleware/error');
const logger = require('../utils/logger');
const { sendEmail } = require('../utils/email');
const { calculateTax, calculateShipping } = require('../utils/calculations');

// Validation middleware
const validateOrderCreate = [
  body('items').isArray().withMessage('Items must be an array'),
  body('items.*.productId').isMongoId().withMessage('Invalid product ID'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('shippingAddress').isObject().withMessage('Shipping address is required'),
  body('shippingAddress.street').notEmpty().withMessage('Street is required'),
  body('shippingAddress.city').notEmpty().withMessage('City is required'),
  body('shippingAddress.state').notEmpty().withMessage('State is required'),
  body('shippingAddress.zipCode').notEmpty().withMessage('Zip code is required'),
  body('shippingAddress.country').notEmpty().withMessage('Country is required'),
  body('paymentMethod').isIn(['credit_card', 'paypal', 'bank_transfer']).withMessage('Invalid payment method'),
  body('couponCode').optional().isString().withMessage('Invalid coupon code')
];

// Create order
router.post('/', auth, validateOrderCreate, async (req, res, next) => {
  try {
    const { items, shippingAddress, paymentMethod, couponCode } = req.body;
    const user = req.user;

    // Get products and check stock
    const products = await Product.find({
      _id: { $in: items.map(item => item.productId) }
    });

    if (products.length !== items.length) {
      throw new AppError('One or more products not found', 404);
    }

    // Check stock and calculate totals
    let subtotal = 0;
    const orderItems = [];

    for (const item of items) {
      const product = products.find(p => p._id.toString() === item.productId);
      
      if (product.stock < item.quantity) {
        throw new AppError(`Insufficient stock for product: ${product.name}`, 400);
      }

      const itemTotal = product.price * item.quantity;
      subtotal += itemTotal;

      orderItems.push({
        product: product._id,
        name: product.name,
        price: product.price,
        quantity: item.quantity,
        total: itemTotal
      });
    }

    // Calculate shipping
    const shipping = calculateShipping(shippingAddress.country, subtotal);

    // Calculate tax
    const tax = calculateTax(subtotal, shippingAddress.country);

    // Apply coupon if provided
    let discount = 0;
    if (couponCode) {
      const coupon = await Coupon.findOne({
        code: couponCode,
        isActive: true,
        startDate: { $lte: new Date() },
        endDate: { $gte: new Date() }
      });

      if (!coupon) {
        throw new AppError('Invalid or expired coupon', 400);
      }

      if (coupon.minPurchase && subtotal < coupon.minPurchase) {
        throw new AppError(`Minimum purchase of ${coupon.minPurchase} required for this coupon`, 400);
      }

      discount = coupon.type === 'percentage'
        ? (subtotal * coupon.value) / 100
        : coupon.value;

      if (coupon.maxDiscount && discount > coupon.maxDiscount) {
        discount = coupon.maxDiscount;
      }
    }

    const total = subtotal + shipping + tax - discount;

    // Create order
    const order = new Order({
      user: user._id,
      items: orderItems,
      shippingAddress,
      paymentMethod,
      subtotal,
      shipping,
      tax,
      discount,
      total,
      status: 'pending',
      coupon: couponCode ? couponCode : undefined
    });

    await order.save();

    // Update product stock
    for (const item of items) {
      await Product.findByIdAndUpdate(item.productId, {
        $inc: { stock: -item.quantity }
      });
    }

    // Send order confirmation email
    await sendEmail({
      to: user.email,
      subject: 'Order Confirmation',
      template: 'order-confirmation',
      context: {
        orderNumber: order._id,
        items: orderItems,
        shippingAddress,
        subtotal,
        shipping,
        tax,
        discount,
        total
      }
    });

    logger.info(`Order created: ${order._id}`);

    res.status(201).json({
      status: 'success',
      message: 'Order created successfully',
      data: { order }
    });
  } catch (error) {
    next(error);
  }
});

// Get user orders
router.get('/my-orders', auth, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const orders = await Order.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('items.product', 'name images');

    const total = await Order.countDocuments({ user: req.user._id });

    res.json({
      status: 'success',
      data: {
        orders,
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

// Get order by ID
router.get('/:id', auth, [
  param('id').isMongoId().withMessage('Invalid order ID')
], async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('items.product', 'name images');

    if (!order) {
      throw new AppError('Order not found', 404);
    }

    // Check if user is authorized to view this order
    if (order.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      throw new AppError('Not authorized to view this order', 403);
    }

    res.json({
      status: 'success',
      data: { order }
    });
  } catch (error) {
    next(error);
  }
});

// Update order status (admin only)
router.put('/:id/status', adminAuth, [
  param('id').isMongoId().withMessage('Invalid order ID'),
  body('status').isIn(['pending', 'processing', 'shipped', 'delivered', 'cancelled'])
    .withMessage('Invalid status')
], async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      throw new AppError('Order not found', 404);
    }

    const { status } = req.body;
    const oldStatus = order.status;
    order.status = status;
    await order.save();

    // Send status update email
    if (status !== oldStatus) {
      const user = await User.findById(order.user);
      await sendEmail({
        to: user.email,
        subject: 'Order Status Update',
        template: 'order-status-update',
        context: {
          orderNumber: order._id,
          oldStatus,
          newStatus: status
        }
      });
    }

    logger.info(`Order status updated: ${order._id} (${oldStatus} -> ${status})`);

    res.json({
      status: 'success',
      message: 'Order status updated successfully',
      data: { order }
    });
  } catch (error) {
    next(error);
  }
});

// Cancel order
router.post('/:id/cancel', auth, [
  param('id').isMongoId().withMessage('Invalid order ID')
], async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      throw new AppError('Order not found', 404);
    }

    // Check if user is authorized to cancel this order
    if (order.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      throw new AppError('Not authorized to cancel this order', 403);
    }

    // Check if order can be cancelled
    if (!['pending', 'processing'].includes(order.status)) {
      throw new AppError('Order cannot be cancelled at this stage', 400);
    }

    // Update order status
    order.status = 'cancelled';
    await order.save();

    // Restore product stock
    for (const item of order.items) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { stock: item.quantity }
      });
    }

    // Send cancellation email
    const user = await User.findById(order.user);
    await sendEmail({
      to: user.email,
      subject: 'Order Cancelled',
      template: 'order-cancelled',
      context: {
        orderNumber: order._id,
        items: order.items,
        total: order.total
      }
    });

    logger.info(`Order cancelled: ${order._id}`);

    res.json({
      status: 'success',
      message: 'Order cancelled successfully',
      data: { order }
    });
  } catch (error) {
    next(error);
  }
});

// Get all orders (admin only)
router.get('/', adminAuth, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const query = {};
    
    // Filter by status
    if (req.query.status) {
      query.status = req.query.status;
    }

    // Filter by date range
    if (req.query.startDate && req.query.endDate) {
      query.createdAt = {
        $gte: new Date(req.query.startDate),
        $lte: new Date(req.query.endDate)
      };
    }

    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('user', 'firstName lastName email')
      .populate('items.product', 'name images');

    const total = await Order.countDocuments(query);

    res.json({
      status: 'success',
      data: {
        orders,
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