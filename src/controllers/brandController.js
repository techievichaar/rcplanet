const Brand = require('../models/Brand');
const Product = require('../models/Product');

// Create a new brand (admin only)
exports.createBrand = async (req, res) => {
    try {
        const brand = new Brand(req.body);
        await brand.save();
        res.status(201).json(brand);
    } catch (error) {
        res.status(400).json({ error: 'Error creating brand' });
    }
};

// Get all brands
exports.getBrands = async (req, res) => {
    try {
        const { 
            page = 1, 
            limit = 10, 
            active, 
            featured,
            category,
            sort = 'name'
        } = req.query;

        const query = {};
        if (active !== undefined) query.isActive = active === 'true';
        if (featured !== undefined) query.featured = featured === 'true';
        if (category) query.categories = category;

        const brands = await Brand.find(query)
            .sort({ [sort]: 1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit))
            .populate('categories', 'name slug');

        const total = await Brand.countDocuments(query);

        res.json({
            brands,
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / limit),
            totalBrands: total
        });
    } catch (error) {
        res.status(500).json({ error: 'Error fetching brands' });
    }
};

// Get brand by ID or slug
exports.getBrand = async (req, res) => {
    try {
        const { id } = req.params;
        const brand = await Brand.findOne({
            $or: [
                { _id: id },
                { slug: id }
            ]
        }).populate('categories', 'name slug');

        if (!brand) {
            return res.status(404).json({ error: 'Brand not found' });
        }

        res.json(brand);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching brand' });
    }
};

// Update brand (admin only)
exports.updateBrand = async (req, res) => {
    try {
        const { id } = req.params;
        const brand = await Brand.findByIdAndUpdate(id, req.body, { 
            new: true,
            runValidators: true
        });
        
        if (!brand) {
            return res.status(404).json({ error: 'Brand not found' });
        }

        res.json(brand);
    } catch (error) {
        res.status(400).json({ error: 'Error updating brand' });
    }
};

// Delete brand (admin only)
exports.deleteBrand = async (req, res) => {
    try {
        const { id } = req.params;
        const brand = await Brand.findById(id);
        
        if (!brand) {
            return res.status(404).json({ error: 'Brand not found' });
        }

        // Check if brand has products
        const productCount = await Product.countDocuments({ brand: id });
        if (productCount > 0) {
            return res.status(400).json({ 
                error: 'Cannot delete brand with associated products' 
            });
        }

        await brand.remove();
        res.json({ message: 'Brand deleted successfully' });
    } catch (error) {
        res.status(400).json({ error: 'Error deleting brand' });
    }
};

// Get brand products
exports.getBrandProducts = async (req, res) => {
    try {
        const { id } = req.params;
        const { 
            page = 1, 
            limit = 12,
            sort = 'createdAt',
            order = 'desc'
        } = req.query;

        const brand = await Brand.findOne({
            $or: [
                { _id: id },
                { slug: id }
            ]
        });

        if (!brand) {
            return res.status(404).json({ error: 'Brand not found' });
        }

        const products = await Product.find({ brand: brand._id })
            .sort({ [sort]: order === 'desc' ? -1 : 1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit))
            .populate('category', 'name slug');

        const total = await Product.countDocuments({ brand: brand._id });

        res.json({
            products,
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / limit),
            totalProducts: total
        });
    } catch (error) {
        res.status(500).json({ error: 'Error fetching brand products' });
    }
};

// Get featured brands
exports.getFeaturedBrands = async (req, res) => {
    try {
        const brands = await Brand.find({ 
            featured: true,
            isActive: true
        }).sort({ order: 1, name: 1 });

        res.json(brands);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching featured brands' });
    }
};

// Update brand order (admin only)
exports.updateBrandOrder = async (req, res) => {
    try {
        const { brands } = req.body;
        
        for (const { id, order } of brands) {
            await Brand.findByIdAndUpdate(id, { order });
        }

        res.json({ message: 'Brand order updated successfully' });
    } catch (error) {
        res.status(400).json({ error: 'Error updating brand order' });
    }
};

// Get brand stats
exports.getBrandStats = async (req, res) => {
    try {
        const { id } = req.params;
        const brand = await Brand.findById(id);
        
        if (!brand) {
            return res.status(404).json({ error: 'Brand not found' });
        }

        await brand.updateStats();
        res.json(brand.stats);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching brand stats' });
    }
}; 