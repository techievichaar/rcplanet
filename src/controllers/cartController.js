const Cart = require('../models/Cart');
const Product = require('../models/Product');

// Get user's cart
exports.getCart = async (req, res) => {
    try {
        const cart = await Cart.findOne({ user: req.user._id })
            .populate('items.product', 'name price images stock');
        
        if (!cart) {
            return res.json({ items: [], total: 0 });
        }

        res.json(cart);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching cart' });
    }
};

// Add item to cart
exports.addToCart = async (req, res) => {
    try {
        const { productId, quantity } = req.body;

        // Check if product exists and has sufficient stock
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        if (product.stock < quantity) {
            return res.status(400).json({ error: 'Insufficient stock' });
        }

        let cart = await Cart.findOne({ user: req.user._id });

        if (!cart) {
            // Create new cart if it doesn't exist
            cart = new Cart({
                user: req.user._id,
                items: [{ product: productId, quantity }]
            });
        } else {
            // Check if product already exists in cart
            const existingItem = cart.items.find(
                item => item.product.toString() === productId
            );

            if (existingItem) {
                // Update quantity if product exists
                if (product.stock < existingItem.quantity + quantity) {
                    return res.status(400).json({ error: 'Insufficient stock' });
                }
                existingItem.quantity += quantity;
            } else {
                // Add new item if product doesn't exist
                cart.items.push({ product: productId, quantity });
            }
        }

        await cart.save();
        await cart.populate('items.product', 'name price images stock');
        
        res.status(201).json(cart);
    } catch (error) {
        res.status(400).json({ error: 'Error adding to cart' });
    }
};

// Update cart item quantity
exports.updateCartItem = async (req, res) => {
    try {
        const { productId } = req.params;
        const { quantity } = req.body;

        // Check if product exists and has sufficient stock
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        if (product.stock < quantity) {
            return res.status(400).json({ error: 'Insufficient stock' });
        }

        const cart = await Cart.findOne({ user: req.user._id });
        if (!cart) {
            return res.status(404).json({ error: 'Cart not found' });
        }

        const item = cart.items.find(
            item => item.product.toString() === productId
        );

        if (!item) {
            return res.status(404).json({ error: 'Item not found in cart' });
        }

        item.quantity = quantity;
        await cart.save();
        await cart.populate('items.product', 'name price images stock');

        res.json(cart);
    } catch (error) {
        res.status(400).json({ error: 'Error updating cart' });
    }
};

// Remove item from cart
exports.removeFromCart = async (req, res) => {
    try {
        const { productId } = req.params;

        const cart = await Cart.findOne({ user: req.user._id });
        if (!cart) {
            return res.status(404).json({ error: 'Cart not found' });
        }

        cart.items = cart.items.filter(
            item => item.product.toString() !== productId
        );

        await cart.save();
        await cart.populate('items.product', 'name price images stock');

        res.json(cart);
    } catch (error) {
        res.status(400).json({ error: 'Error removing from cart' });
    }
};

// Clear cart
exports.clearCart = async (req, res) => {
    try {
        const cart = await Cart.findOne({ user: req.user._id });
        if (!cart) {
            return res.status(404).json({ error: 'Cart not found' });
        }

        cart.items = [];
        await cart.save();

        res.json({ message: 'Cart cleared successfully' });
    } catch (error) {
        res.status(400).json({ error: 'Error clearing cart' });
    }
};

// Apply coupon to cart
exports.applyCoupon = async (req, res) => {
    try {
        const { code } = req.body;

        const cart = await Cart.findOne({ user: req.user._id });
        if (!cart) {
            return res.status(404).json({ error: 'Cart not found' });
        }

        // Validate coupon code and calculate discount
        const discount = await validateCoupon(code, cart.total);
        if (!discount) {
            return res.status(400).json({ error: 'Invalid coupon code' });
        }

        cart.discount = {
            code,
            amount: discount
        };

        await cart.save();
        await cart.populate('items.product', 'name price images stock');

        res.json(cart);
    } catch (error) {
        res.status(400).json({ error: 'Error applying coupon' });
    }
};

// Remove coupon from cart
exports.removeCoupon = async (req, res) => {
    try {
        const cart = await Cart.findOne({ user: req.user._id });
        if (!cart) {
            return res.status(404).json({ error: 'Cart not found' });
        }

        cart.discount = null;
        await cart.save();
        await cart.populate('items.product', 'name price images stock');

        res.json(cart);
    } catch (error) {
        res.status(400).json({ error: 'Error removing coupon' });
    }
};

// Helper function to validate coupon
async function validateCoupon(code, total) {
    // Implement coupon validation logic
    // This is a placeholder
    const validCoupons = {
        'WELCOME10': 0.1, // 10% discount
        'FREESHIP': 5,    // $5 discount
        'BIGSALE': 0.2    // 20% discount
    };

    if (validCoupons[code]) {
        return validCoupons[code] < 1 
            ? total * validCoupons[code] 
            : validCoupons[code];
    }
    return null;
} 