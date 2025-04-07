const Coupon = require('../models/Coupon');

// Create a new coupon (admin only)
exports.createCoupon = async (req, res) => {
    try {
        const coupon = new Coupon(req.body);
        await coupon.save();
        res.status(201).json(coupon);
    } catch (error) {
        res.status(400).json({ error: 'Error creating coupon' });
    }
};

// Get all coupons (admin only)
exports.getCoupons = async (req, res) => {
    try {
        const { page = 1, limit = 10, active } = req.query;
        const query = active ? { isActive: true } : {};

        const coupons = await Coupon.find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        const total = await Coupon.countDocuments(query);

        res.json({
            coupons,
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / limit),
            totalCoupons: total
        });
    } catch (error) {
        res.status(500).json({ error: 'Error fetching coupons' });
    }
};

// Get coupon by code
exports.getCouponByCode = async (req, res) => {
    try {
        const { code } = req.params;
        const coupon = await Coupon.findOne({ code: code.toUpperCase() });
        
        if (!coupon) {
            return res.status(404).json({ error: 'Coupon not found' });
        }

        res.json(coupon);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching coupon' });
    }
};

// Update coupon (admin only)
exports.updateCoupon = async (req, res) => {
    try {
        const { id } = req.params;
        const coupon = await Coupon.findByIdAndUpdate(id, req.body, { new: true });
        
        if (!coupon) {
            return res.status(404).json({ error: 'Coupon not found' });
        }

        res.json(coupon);
    } catch (error) {
        res.status(400).json({ error: 'Error updating coupon' });
    }
};

// Delete coupon (admin only)
exports.deleteCoupon = async (req, res) => {
    try {
        const { id } = req.params;
        const coupon = await Coupon.findByIdAndDelete(id);
        
        if (!coupon) {
            return res.status(404).json({ error: 'Coupon not found' });
        }

        res.json({ message: 'Coupon deleted successfully' });
    } catch (error) {
        res.status(400).json({ error: 'Error deleting coupon' });
    }
};

// Validate coupon
exports.validateCoupon = async (req, res) => {
    try {
        const { code } = req.params;
        const { userId, subtotal, products } = req.body;

        const coupon = await Coupon.findOne({ code: code.toUpperCase() });
        if (!coupon) {
            return res.status(404).json({ error: 'Invalid coupon code' });
        }

        // Check if coupon is valid
        if (!coupon.isValid) {
            return res.status(400).json({ error: 'Coupon is not valid' });
        }

        // Check minimum purchase amount
        if (subtotal < coupon.minPurchase) {
            return res.status(400).json({ 
                error: `Minimum purchase amount of $${coupon.minPurchase} required` 
            });
        }

        // Check if user has reached usage limit
        const canUse = await coupon.checkUserUsage(userId);
        if (!canUse) {
            return res.status(400).json({ error: 'Coupon usage limit reached' });
        }

        // Check if coupon can be applied to products
        if (products) {
            for (const product of products) {
                if (!coupon.isValidForProduct(product._id)) {
                    return res.status(400).json({ 
                        error: 'Coupon cannot be applied to some products in cart' 
                    });
                }
            }
        }

        // Calculate discount amount
        const discount = coupon.calculateDiscount(subtotal);

        res.json({
            valid: true,
            discount,
            type: coupon.type,
            description: coupon.description
        });
    } catch (error) {
        res.status(400).json({ error: 'Error validating coupon' });
    }
};

// Get active coupons
exports.getActiveCoupons = async (req, res) => {
    try {
        const now = new Date();
        const coupons = await Coupon.find({
            isActive: true,
            startDate: { $lte: now },
            endDate: { $gte: now }
        }).select('code type value description');

        res.json(coupons);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching active coupons' });
    }
}; 