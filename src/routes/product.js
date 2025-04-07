const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const { auth, adminAuth } = require('../middleware/auth');
const Product = require('../models/Product');
const Category = require('../models/Category');
const Review = require('../models/Review');
const { AppError } = require('../middleware/error');
const logger = require('../utils/logger');
const multer = require('multer');
const path = require('path');

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/products');
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
    fileSize: 5 * 1024 * 1024 // 5MB
  }
});

// Validation middleware
const validateProduct = [
  body('name').notEmpty().withMessage('Name is required'),
  body('description').notEmpty().withMessage('Description is required'),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('stock').isInt({ min: 0 }).withMessage('Stock must be a non-negative integer'),
  body('category').isMongoId().withMessage('Invalid category ID'),
  body('brand').optional().notEmpty().withMessage('Brand cannot be empty'),
  body('attributes').optional().isObject().withMessage('Attributes must be an object'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean')
];

// Get all products
router.get('/', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Build filter query
    const filter = { isActive: true };
    
    // Filter by category
    if (req.query.category) {
      filter.category = req.query.category;
    }

    // Filter by price range
    if (req.query.minPrice) {
      filter.price = { $gte: parseFloat(req.query.minPrice) };
    }
    if (req.query.maxPrice) {
      filter.price = { ...filter.price, $lte: parseFloat(req.query.maxPrice) };
    }

    // Filter by brand
    if (req.query.brand) {
      filter.brand = req.query.brand;
    }

    // Build sort query
    const sort = {};
    if (req.query.sort) {
      const [field, order] = req.query.sort.startsWith('-') 
        ? [req.query.sort.slice(1), -1] 
        : [req.query.sort, 1];
      sort[field] = order;
    } else {
      sort.createdAt = -1;
    }

    const products = await Product.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('category', 'name')
      .populate('reviews', 'rating');

    const total = await Product.countDocuments(filter);

    res.json({
      status: 'success',
      data: {
        products,
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

// Get product by ID
router.get('/:id', [
  param('id').isMongoId().withMessage('Invalid product ID')
], async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('category', 'name')
      .populate('reviews', 'rating comment user');

    if (!product) {
      throw new AppError('Product not found', 404);
    }

    res.json({
      status: 'success',
      data: { product }
    });
  } catch (error) {
    next(error);
  }
});

// Create product (admin only)
router.post('/', adminAuth, upload.array('images', 5), validateProduct, async (req, res, next) => {
  try {
    const {
      name,
      description,
      price,
      stock,
      category,
      brand,
      attributes,
      isActive
    } = req.body;

    // Check if category exists
    const categoryExists = await Category.findById(category);
    if (!categoryExists) {
      throw new AppError('Category not found', 404);
    }

    // Handle image uploads
    const images = req.files ? req.files.map(file => file.path) : [];

    const product = new Product({
      name,
      description,
      price,
      stock,
      category,
      brand,
      attributes,
      images,
      isActive: isActive !== undefined ? isActive : true
    });

    await product.save();

    logger.info(`Product created: ${product.name}`);

    res.status(201).json({
      status: 'success',
      message: 'Product created successfully',
      data: { product }
    });
  } catch (error) {
    next(error);
  }
});

// Update product (admin only)
router.put('/:id', adminAuth, upload.array('images', 5), validateProduct, async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      throw new AppError('Product not found', 404);
    }

    const {
      name,
      description,
      price,
      stock,
      category,
      brand,
      attributes,
      isActive
    } = req.body;

    // Check if category exists
    if (category !== product.category.toString()) {
      const categoryExists = await Category.findById(category);
      if (!categoryExists) {
        throw new AppError('Category not found', 404);
      }
    }

    // Handle image uploads
    if (req.files && req.files.length > 0) {
      product.images = req.files.map(file => file.path);
    }

    // Update product
    product.name = name;
    product.description = description;
    product.price = price;
    product.stock = stock;
    product.category = category;
    product.brand = brand;
    product.attributes = attributes;
    if (isActive !== undefined) {
      product.isActive = isActive;
    }

    await product.save();

    logger.info(`Product updated: ${product.name}`);

    res.json({
      status: 'success',
      message: 'Product updated successfully',
      data: { product }
    });
  } catch (error) {
    next(error);
  }
});

// Delete product (admin only)
router.delete('/:id', adminAuth, async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      throw new AppError('Product not found', 404);
    }

    // Soft delete
    product.isActive = false;
    await product.save();

    logger.info(`Product deleted: ${product.name}`);

    res.json({
      status: 'success',
      message: 'Product deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

// Get product reviews
router.get('/:id/reviews', [
  param('id').isMongoId().withMessage('Invalid product ID'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1 }).withMessage('Limit must be a positive integer'),
  query('rating').optional().isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5')
], async (req, res, next) => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Build filter query
    const filter = { product: id };
    if (req.query.rating) {
      filter.rating = parseInt(req.query.rating);
    }

    const reviews = await Review.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('user', 'firstName lastName');

    const total = await Review.countDocuments(filter);

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

// Get similar products
router.get('/:id/similar', [
  param('id').isMongoId().withMessage('Invalid product ID')
], async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      throw new AppError('Product not found', 404);
    }

    const similarProducts = await Product.find({
      category: product.category,
      _id: { $ne: product._id },
      isActive: true
    })
      .limit(5)
      .select('name price images rating')
      .sort({ rating: -1 });

    res.json({
      status: 'success',
      data: { products: similarProducts }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router; 