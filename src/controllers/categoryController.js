const Category = require('../models/Category');

// Create a new category (admin only)
exports.createCategory = async (req, res) => {
    try {
        const category = new Category(req.body);
        await category.save();
        res.status(201).json(category);
    } catch (error) {
        res.status(400).json({ error: 'Error creating category' });
    }
};

// Get all categories
exports.getCategories = async (req, res) => {
    try {
        const { 
            page = 1, 
            limit = 10, 
            active, 
            featured,
            parent = null,
            level
        } = req.query;

        const query = {};
        if (active !== undefined) query.isActive = active === 'true';
        if (featured !== undefined) query.featured = featured === 'true';
        if (parent !== undefined) query.parent = parent === 'null' ? null : parent;
        if (level !== undefined) query.level = parseInt(level);

        const categories = await Category.find(query)
            .sort({ order: 1, name: 1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit))
            .populate('parent', 'name slug');

        const total = await Category.countDocuments(query);

        res.json({
            categories,
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / limit),
            totalCategories: total
        });
    } catch (error) {
        res.status(500).json({ error: 'Error fetching categories' });
    }
};

// Get category by ID or slug
exports.getCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const category = await Category.findOne({
            $or: [
                { _id: id },
                { slug: id }
            ]
        }).populate('parent', 'name slug');

        if (!category) {
            return res.status(404).json({ error: 'Category not found' });
        }

        // Get breadcrumb
        const breadcrumb = await category.getBreadcrumb();
        
        // Get children
        const children = await category.getChildren();
        
        // Get product count
        const productCount = await category.productCount;

        res.json({
            ...category.toObject(),
            breadcrumb,
            children,
            productCount
        });
    } catch (error) {
        res.status(500).json({ error: 'Error fetching category' });
    }
};

// Update category (admin only)
exports.updateCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const category = await Category.findByIdAndUpdate(id, req.body, { 
            new: true,
            runValidators: true
        });
        
        if (!category) {
            return res.status(404).json({ error: 'Category not found' });
        }

        res.json(category);
    } catch (error) {
        res.status(400).json({ error: 'Error updating category' });
    }
};

// Delete category (admin only)
exports.deleteCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const category = await Category.findById(id);
        
        if (!category) {
            return res.status(404).json({ error: 'Category not found' });
        }

        // Check if category has children
        const hasChildren = await category.getChildren();
        if (hasChildren.length > 0) {
            return res.status(400).json({ 
                error: 'Cannot delete category with subcategories' 
            });
        }

        await category.remove();
        res.json({ message: 'Category deleted successfully' });
    } catch (error) {
        res.status(400).json({ error: 'Error deleting category' });
    }
};

// Get category tree
exports.getCategoryTree = async (req, res) => {
    try {
        const buildTree = async (parentId = null) => {
            const categories = await Category.find({ parent: parentId })
                .sort({ order: 1, name: 1 });
            
            const tree = [];
            
            for (const category of categories) {
                const children = await buildTree(category._id);
                tree.push({
                    ...category.toObject(),
                    children
                });
            }
            
            return tree;
        };

        const tree = await buildTree();
        res.json(tree);
    } catch (error) {
        res.status(500).json({ error: 'Error building category tree' });
    }
};

// Get featured categories
exports.getFeaturedCategories = async (req, res) => {
    try {
        const categories = await Category.find({ 
            featured: true,
            isActive: true
        }).sort({ order: 1, name: 1 });

        res.json(categories);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching featured categories' });
    }
};

// Update category order (admin only)
exports.updateCategoryOrder = async (req, res) => {
    try {
        const { categories } = req.body;
        
        for (const { id, order } of categories) {
            await Category.findByIdAndUpdate(id, { order });
        }

        res.json({ message: 'Category order updated successfully' });
    } catch (error) {
        res.status(400).json({ error: 'Error updating category order' });
    }
}; 