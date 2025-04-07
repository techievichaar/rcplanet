const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const { auth } = require('../middleware/auth');
const User = require('../models/User');
const Address = require('../models/Address');
const { AppError } = require('../middleware/error');
const logger = require('../utils/logger');

// Validation middleware
const validateAddress = [
  body('street').notEmpty().withMessage('Street is required'),
  body('city').notEmpty().withMessage('City is required'),
  body('state').notEmpty().withMessage('State is required'),
  body('zipCode').notEmpty().withMessage('Zip code is required'),
  body('country').notEmpty().withMessage('Country is required'),
  body('isDefault').optional().isBoolean().withMessage('isDefault must be a boolean'),
  body('label').optional().notEmpty().withMessage('Label cannot be empty')
];

// Get all addresses
router.get('/', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).populate('addresses');
    
    res.json({
      status: 'success',
      data: {
        addresses: user.addresses
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get address by ID
router.get('/:id', auth, [
  param('id').isMongoId().withMessage('Invalid address ID')
], async (req, res, next) => {
  try {
    const address = await Address.findOne({
      _id: req.params.id,
      user: req.user.id
    });

    if (!address) {
      throw new AppError('Address not found', 404);
    }

    res.json({
      status: 'success',
      data: { address }
    });
  } catch (error) {
    next(error);
  }
});

// Create address
router.post('/', auth, validateAddress, async (req, res, next) => {
  try {
    const {
      street,
      city,
      state,
      zipCode,
      country,
      isDefault,
      label
    } = req.body;

    // Create address
    const address = new Address({
      user: req.user.id,
      street,
      city,
      state,
      zipCode,
      country,
      isDefault: isDefault || false,
      label
    });

    // If this is set as default, unset other default addresses
    if (isDefault) {
      await Address.updateMany(
        { user: req.user.id, _id: { $ne: address._id } },
        { isDefault: false }
      );
    }

    await address.save();

    // Add address to user
    const user = await User.findById(req.user.id);
    user.addresses.push(address._id);
    await user.save();

    logger.info(`Address created for user: ${user.email}`);

    res.status(201).json({
      status: 'success',
      message: 'Address created successfully',
      data: { address }
    });
  } catch (error) {
    next(error);
  }
});

// Update address
router.put('/:id', auth, [
  param('id').isMongoId().withMessage('Invalid address ID')
], validateAddress, async (req, res, next) => {
  try {
    const address = await Address.findOne({
      _id: req.params.id,
      user: req.user.id
    });

    if (!address) {
      throw new AppError('Address not found', 404);
    }

    const {
      street,
      city,
      state,
      zipCode,
      country,
      isDefault,
      label
    } = req.body;

    // Update address
    address.street = street;
    address.city = city;
    address.state = state;
    address.zipCode = zipCode;
    address.country = country;
    address.label = label;

    // Handle default address
    if (isDefault && !address.isDefault) {
      await Address.updateMany(
        { user: req.user.id, _id: { $ne: address._id } },
        { isDefault: false }
      );
      address.isDefault = true;
    }

    await address.save();

    logger.info(`Address updated for user: ${req.user.id}`);

    res.json({
      status: 'success',
      message: 'Address updated successfully',
      data: { address }
    });
  } catch (error) {
    next(error);
  }
});

// Delete address
router.delete('/:id', auth, [
  param('id').isMongoId().withMessage('Invalid address ID')
], async (req, res, next) => {
  try {
    const address = await Address.findOne({
      _id: req.params.id,
      user: req.user.id
    });

    if (!address) {
      throw new AppError('Address not found', 404);
    }

    // Remove address from user
    const user = await User.findById(req.user.id);
    user.addresses = user.addresses.filter(
      addr => addr.toString() !== address._id.toString()
    );
    await user.save();

    // Delete address
    await address.remove();

    logger.info(`Address deleted for user: ${req.user.id}`);

    res.json({
      status: 'success',
      message: 'Address deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

// Set default address
router.put('/:id/default', auth, [
  param('id').isMongoId().withMessage('Invalid address ID')
], async (req, res, next) => {
  try {
    const address = await Address.findOne({
      _id: req.params.id,
      user: req.user.id
    });

    if (!address) {
      throw new AppError('Address not found', 404);
    }

    // Unset other default addresses
    await Address.updateMany(
      { user: req.user.id, _id: { $ne: address._id } },
      { isDefault: false }
    );

    // Set this address as default
    address.isDefault = true;
    await address.save();

    logger.info(`Default address set for user: ${req.user.id}`);

    res.json({
      status: 'success',
      message: 'Default address set successfully',
      data: { address }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router; 