const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const { auth, adminAuth } = require('../middleware/auth');
const Category = require('../models/Category');
const Product = require('../models/Product');
const { AppError } = require('../middleware/error');
const logger = require('../utils/logger');
const multer = require('multer');
const path = require('path');

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/categories');
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
const validateCategory = [
  body('name').notEmpty().withMessage('Name is required'),
  body('description').optional().notEmpty().withMessage('Description cannot be empty'),
  body('parent').optional().isMongoId().withMessage('Invalid parent category ID'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean')
];

// Get all categories
router.get('/', async (req, res, next) => {
  try {
    const categories = await Category.find({ isActive: true })
      .populate('parent', 'name')
      .sort('name');

    res.json({
      status: 'success',
      data: { categories }
    });
  } catch (error) {
    next(error);
  }
});

// Get category by ID
router.get('/:id', [
  param('id').isMongoId().withMessage('Invalid category ID')
], async (req, res, next) => {
  try {
    const category = await Category.findById(req.params.id)
      .populate('parent', 'name');

    if (!category) {
      throw new AppError('Category not found', 404);
    }

    res.json({
      status: 'success',
      data: { category }
    });
  } catch (error) {
    next(error);
  }
});

// Create category (admin only)
router.post('/', adminAuth, upload.single('image'), validateCategory, async (req, res, next) => {
  try {
    const { name, description, parent, isActive } = req.body;

    // Check if category name already exists
    const existingCategory = await Category.findOne({ name });
    if (existingCategory) {
      throw new AppError('Category name already exists', 400);
    }

    // Validate parent category if provided
    if (parent) {
      const parentCategory = await Category.findById(parent);
      if (!parentCategory) {
        throw new AppError('Parent category not found', 404);
      }
    }

    const category = new Category({
      name,
      description,
      parent,
      image: req.file ? req.file.path : undefined,
      isActive: isActive !== undefined ? isActive : true
    });

    await category.save();

    logger.info(`Category created: ${category.name}`);

    res.status(201).json({
      status: 'success',
      message: 'Category created successfully',
      data: { category }
    });
  } catch (error) {
    next(error);
  }
});

// Update category (admin only)
router.put('/:id', adminAuth, upload.single('image'), validateCategory, async (req, res, next) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      throw new AppError('Category not found', 404);
    }

    const { name, description, parent, isActive } = req.body;

    // Check if new name already exists
    if (name !== category.name) {
      const existingCategory = await Category.findOne({ name });
      if (existingCategory) {
        throw new AppError('Category name already exists', 400);
      }
    }

    // Validate parent category if provided
    if (parent && parent !== category.parent?.toString()) {
      const parentCategory = await Category.findById(parent);
      if (!parentCategory) {
        throw new AppError('Parent category not found', 404);
      }

      // Check for circular reference
      if (parent === category._id.toString()) {
        throw new AppError('Category cannot be its own parent', 400);
      }
    }

    // Update category
    category.name = name;
    category.description = description;
    category.parent = parent;
    if (req.file) {
      category.image = req.file.path;
    }
    if (isActive !== undefined) {
      category.isActive = isActive;
    }

    await category.save();

    logger.info(`Category updated: ${category.name}`);

    res.json({
      status: 'success',
      message: 'Category updated successfully',
      data: { category }
    });
  } catch (error) {
    next(error);
  }
});

// Delete category (admin only)
router.delete('/:id', adminAuth, async (req, res, next) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      throw new AppError('Category not found', 404);
    }

    // Check if category has products
    const hasProducts = await Product.exists({ category: category._id });
    if (hasProducts) {
      throw new AppError('Cannot delete category with existing products', 400);
    }

    // Check if category has subcategories
    const hasSubcategories = await Category.exists({ parent: category._id });
    if (hasSubcategories) {
      throw new AppError('Cannot delete category with existing subcategories', 400);
    }

    await category.remove();

    logger.info(`Category deleted: ${category.name}`);

    res.json({
      status: 'success',
      message: 'Category deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

// Get category products
router.get('/:id/products', [
  param('id').isMongoId().withMessage('Invalid category ID'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1 }).withMessage('Limit must be a positive integer')
], async (req, res, next) => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Get category and its subcategories
    const category = await Category.findById(id);
    if (!category) {
      throw new AppError('Category not found', 404);
    }

    const subcategories = await Category.find({ parent: id });
    const categoryIds = [id, ...subcategories.map(cat => cat._id)];

    const products = await Product.find({ category: { $in: categoryIds } })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Product.countDocuments({ category: { $in: categoryIds } });

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

// Get category tree
router.get('/tree', async (req, res, next) => {
  try {
    const categories = await Category.find({ isActive: true })
      .select('name parent')
      .sort('name');

    const buildTree = (parentId = null) => {
      const children = categories
        .filter(category => 
          (category.parent && category.parent.toString() === parentId) || 
          (!category.parent && !parentId)
        )
        .map(category => ({
          id: category._id,
          name: category.name,
          children: buildTree(category._id.toString())
        }));

      return children;
    };

    const tree = buildTree();

    res.json({
      status: 'success',
      data: { tree }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router; 