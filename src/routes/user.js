const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const { auth, adminAuth } = require('../middleware/auth');
const User = require('../models/User');
const Order = require('../models/Order');
const { AppError } = require('../middleware/error');
const logger = require('../utils/logger');
const { sendEmail } = require('../utils/email');
const multer = require('multer');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Configure multer for avatar uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/avatars');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new AppError('Only image files are allowed', 400));
    }
  },
  limits: {
    fileSize: 2 * 1024 * 1024 // 2MB
  }
});

// Validation middleware
const validateUser = [
  body('firstName').notEmpty().withMessage('First name is required'),
  body('lastName').notEmpty().withMessage('Last name is required'),
  body('email').isEmail().withMessage('Invalid email address'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
  body('role').optional().isIn(['user', 'admin']).withMessage('Invalid role')
];

// Register user
router.post('/register', validateUser, async (req, res, next) => {
  try {
    const { firstName, lastName, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new AppError('Email already registered', 400);
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const user = new User({
      firstName,
      lastName,
      email,
      password: hashedPassword
    });

    await user.save();

    // Generate token
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Send welcome email
    await sendEmail({
      to: user.email,
      subject: 'Welcome to Our Store',
      template: 'welcome',
      context: {
        name: user.firstName
      }
    });

    logger.info(`User registered: ${user.email}`);

    res.status(201).json({
      status: 'success',
      message: 'User registered successfully',
      data: {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role
        },
        token
      }
    });
  } catch (error) {
    next(error);
  }
});

// Login user
router.post('/login', [
  body('email').isEmail().withMessage('Invalid email address'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      throw new AppError('Invalid credentials', 401);
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new AppError('Invalid credentials', 401);
    }

    // Generate token
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    logger.info(`User logged in: ${user.email}`);

    res.json({
      status: 'success',
      message: 'Logged in successfully',
      data: {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role
        },
        token
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get user profile
router.get('/profile', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id)
      .select('-password')
      .populate('addresses');

    res.json({
      status: 'success',
      data: { user }
    });
  } catch (error) {
    next(error);
  }
});

// Update user profile
router.put('/profile', auth, upload.single('avatar'), [
  body('firstName').optional().notEmpty().withMessage('First name cannot be empty'),
  body('lastName').optional().notEmpty().withMessage('Last name cannot be empty'),
  body('email').optional().isEmail().withMessage('Invalid email address'),
  body('phone').optional().isMobilePhone().withMessage('Invalid phone number')
], async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    const { firstName, lastName, email, phone } = req.body;

    // Check if email is already taken
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        throw new AppError('Email already registered', 400);
      }
    }

    // Update user
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (email) user.email = email;
    if (phone) user.phone = phone;
    if (req.file) user.avatar = req.file.path;

    await user.save();

    logger.info(`User profile updated: ${user.email}`);

    res.json({
      status: 'success',
      message: 'Profile updated successfully',
      data: { user }
    });
  } catch (error) {
    next(error);
  }
});

// Change password
router.put('/change-password', auth, [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters long')
], async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    const { currentPassword, newPassword } = req.body;

    // Check current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      throw new AppError('Current password is incorrect', 400);
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password
    user.password = hashedPassword;
    await user.save();

    logger.info(`User password changed: ${user.email}`);

    res.json({
      status: 'success',
      message: 'Password changed successfully'
    });
  } catch (error) {
    next(error);
  }
});

// Get user orders
router.get('/orders', auth, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const orders = await Order.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('items.product', 'name images');

    const total = await Order.countDocuments({ user: req.user.id });

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

// Admin routes
// Get all users (admin only)
router.get('/', adminAuth, async (req, res, next) => {
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

// Get user by ID (admin only)
router.get('/:id', adminAuth, [
  param('id').isMongoId().withMessage('Invalid user ID')
], async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password')
      .populate('addresses');

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

// Update user (admin only)
router.put('/:id', adminAuth, [
  param('id').isMongoId().withMessage('Invalid user ID'),
  body('role').optional().isIn(['user', 'admin']).withMessage('Invalid role'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean')
], async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    const { role, isActive } = req.body;

    if (role) user.role = role;
    if (isActive !== undefined) user.isActive = isActive;

    await user.save();

    logger.info(`User updated by admin: ${user.email}`);

    res.json({
      status: 'success',
      message: 'User updated successfully',
      data: { user }
    });
  } catch (error) {
    next(error);
  }
});

// Delete user (admin only)
router.delete('/:id', adminAuth, [
  param('id').isMongoId().withMessage('Invalid user ID')
], async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Check if user has orders
    const hasOrders = await Order.exists({ user: user._id });
    if (hasOrders) {
      throw new AppError('Cannot delete user with existing orders', 400);
    }

    // Soft delete
    user.isActive = false;
    await user.save();

    logger.info(`User deleted by admin: ${user.email}`);

    res.json({
      status: 'success',
      message: 'User deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router; 