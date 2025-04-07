const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const { auth } = require('../middleware/auth');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const { AppError } = require('../middleware/error');
const logger = require('../utils/logger');

// Validation middleware
const validateCartItem = [
  body('productId').isMongoId().withMessage('Invalid product ID'),
  body('quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1')
];

// Get user's cart
router.get('/', auth, async (req, res, next) => {
  try {
    const cart = await Cart.findOne({ user: req.user.id })
      .populate('items.product', 'name price images stock');

    if (!cart) {
      return res.json({
        status: 'success',
        data: { cart: { items: [], total: 0 } }
      });
    }

    // Calculate total
    const total = cart.items.reduce((sum, item) => {
      return sum + (item.product.price * item.quantity);
    }, 0);

    res.json({
      status: 'success',
      data: { cart: { ...cart.toObject(), total } }
    });
  } catch (error) {
    next(error);
  }
});

// Add item to cart
router.post('/items', auth, validateCartItem, async (req, res, next) => {
  try {
    const { productId, quantity } = req.body;

    // Check if product exists and is active
    const product = await Product.findOne({
      _id: productId,
      isActive: true
    });

    if (!product) {
      throw new AppError('Product not found or inactive', 404);
    }

    // Check stock availability
    if (product.stock < quantity) {
      throw new AppError('Insufficient stock', 400);
    }

    let cart = await Cart.findOne({ user: req.user.id });

    if (!cart) {
      cart = new Cart({
        user: req.user.id,
        items: [{ product: productId, quantity }]
      });
    } else {
      // Check if product already exists in cart
      const existingItem = cart.items.find(
        item => item.product.toString() === productId
      );

      if (existingItem) {
        // Update quantity if product exists
        const newQuantity = existingItem.quantity + quantity;
        if (newQuantity > product.stock) {
          throw new AppError('Insufficient stock for requested quantity', 400);
        }
        existingItem.quantity = newQuantity;
      } else {
        // Add new item if product doesn't exist
        cart.items.push({ product: productId, quantity });
      }
    }

    await cart.save();

    logger.info(`Item added to cart: ${productId} by user: ${req.user.email}`);

    res.status(201).json({
      status: 'success',
      message: 'Item added to cart successfully',
      data: { cart }
    });
  } catch (error) {
    next(error);
  }
});

// Update cart item quantity
router.put('/items/:productId', auth, [
  param('productId').isMongoId().withMessage('Invalid product ID'),
  body('quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1')
], async (req, res, next) => {
  try {
    const { productId } = req.params;
    const { quantity } = req.body;

    const cart = await Cart.findOne({ user: req.user.id });
    if (!cart) {
      throw new AppError('Cart not found', 404);
    }

    // Check if product exists in cart
    const item = cart.items.find(
      item => item.product.toString() === productId
    );

    if (!item) {
      throw new AppError('Item not found in cart', 404);
    }

    // Check product stock
    const product = await Product.findById(productId);
    if (!product || !product.isActive) {
      throw new AppError('Product not found or inactive', 404);
    }

    if (product.stock < quantity) {
      throw new AppError('Insufficient stock', 400);
    }

    // Update quantity
    item.quantity = quantity;
    await cart.save();

    logger.info(`Cart item quantity updated: ${productId} by user: ${req.user.email}`);

    res.json({
      status: 'success',
      message: 'Cart item updated successfully',
      data: { cart }
    });
  } catch (error) {
    next(error);
  }
});

// Remove item from cart
router.delete('/items/:productId', auth, [
  param('productId').isMongoId().withMessage('Invalid product ID')
], async (req, res, next) => {
  try {
    const { productId } = req.params;

    const cart = await Cart.findOne({ user: req.user.id });
    if (!cart) {
      throw new AppError('Cart not found', 404);
    }

    // Remove item from cart
    cart.items = cart.items.filter(
      item => item.product.toString() !== productId
    );

    await cart.save();

    logger.info(`Item removed from cart: ${productId} by user: ${req.user.email}`);

    res.json({
      status: 'success',
      message: 'Item removed from cart successfully',
      data: { cart }
    });
  } catch (error) {
    next(error);
  }
});

// Clear cart
router.delete('/', auth, async (req, res, next) => {
  try {
    const cart = await Cart.findOne({ user: req.user.id });
    if (!cart) {
      throw new AppError('Cart not found', 404);
    }

    cart.items = [];
    await cart.save();

    logger.info(`Cart cleared by user: ${req.user.email}`);

    res.json({
      status: 'success',
      message: 'Cart cleared successfully',
      data: { cart }
    });
  } catch (error) {
    next(error);
  }
});

// Apply coupon to cart
router.post('/coupon', auth, [
  body('code').notEmpty().withMessage('Coupon code is required')
], async (req, res, next) => {
  try {
    const { code } = req.body;

    const cart = await Cart.findOne({ user: req.user.id })
      .populate('items.product', 'price');
    
    if (!cart) {
      throw new AppError('Cart not found', 404);
    }

    // Check if coupon is valid and applicable
    const coupon = await Coupon.findOne({
      code,
      isActive: true,
      startDate: { $lte: new Date() },
      endDate: { $gte: new Date() }
    });

    if (!coupon) {
      throw new AppError('Invalid or expired coupon', 400);
    }

    // Check if user has already used this coupon
    if (coupon.usedBy.includes(req.user.id)) {
      throw new AppError('Coupon already used', 400);
    }

    // Calculate cart total
    const subtotal = cart.items.reduce((sum, item) => {
      return sum + (item.product.price * item.quantity);
    }, 0);

    // Apply coupon discount
    let discount = 0;
    if (coupon.type === 'percentage') {
      discount = (subtotal * coupon.value) / 100;
    } else {
      discount = coupon.value;
    }

    // Update cart with coupon
    cart.coupon = {
      code: coupon.code,
      discount
    };

    await cart.save();

    logger.info(`Coupon applied to cart: ${code} by user: ${req.user.email}`);

    res.json({
      status: 'success',
      message: 'Coupon applied successfully',
      data: { cart }
    });
  } catch (error) {
    next(error);
  }
});

// Remove coupon from cart
router.delete('/coupon', auth, async (req, res, next) => {
  try {
    const cart = await Cart.findOne({ user: req.user.id });
    if (!cart) {
      throw new AppError('Cart not found', 404);
    }

    if (!cart.coupon) {
      throw new AppError('No coupon applied to cart', 400);
    }

    cart.coupon = undefined;
    await cart.save();

    logger.info(`Coupon removed from cart by user: ${req.user.email}`);

    res.json({
      status: 'success',
      message: 'Coupon removed successfully',
      data: { cart }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router; 