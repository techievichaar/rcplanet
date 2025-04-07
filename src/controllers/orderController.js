const Order = require('../models/Order');
const OrderStatus = require('../models/OrderStatus');
const Refund = require('../models/Refund');
const Product = require('../models/Product');
const Coupon = require('../models/Coupon');
const User = require('../models/User');
const { calculateTax, calculateShippingCost } = require('../utils/calculations');
const { sendOrderConfirmationEmail, sendOrderStatusUpdateEmail } = require('../utils/email');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Create a new order
exports.createOrder = async (req, res) => {
    try {
        const { items, shippingAddress, paymentMethod, couponCode } = req.body;
        const user = req.user;

        // Validate items and calculate totals
        let subtotal = 0;
        const orderItems = [];

        for (const item of items) {
            const product = await Product.findById(item.product);
            if (!product) {
                return res.status(404).json({ message: `Product not found: ${item.product}` });
            }

            if (product.stock < item.quantity) {
                return res.status(400).json({ message: `Insufficient stock for product: ${product.name}` });
            }

            const itemTotal = product.price * item.quantity;
            subtotal += itemTotal;

            orderItems.push({
                product: product._id,
                name: product.name,
                quantity: item.quantity,
                price: product.price,
                variant: item.variant,
                total: itemTotal
            });
        }

        // Calculate shipping cost
        const shippingCost = await calculateShippingCost(shippingAddress);

        // Calculate tax
        const tax = await calculateTax(subtotal, shippingAddress);

        // Apply coupon if provided
        let discount = 0;
        let coupon = null;
        if (couponCode) {
            coupon = await Coupon.findOne({ code: couponCode });
            if (coupon) {
                if (coupon.type === 'percentage') {
                    discount = (subtotal * coupon.discount) / 100;
                } else {
                    discount = coupon.discount;
                }
            }
        }

        // Calculate total
        const total = subtotal + shippingCost + tax - discount;

        // Create order
        const order = new Order({
            user: user._id,
            items: orderItems,
            subtotal,
            shipping: {
                method: 'standard',
                cost: shippingCost,
                address: shippingAddress
            },
            tax: {
                rate: process.env.TAX_RATE || 0,
                amount: tax
            },
            total,
            payment: {
                method: paymentMethod,
                amount: total,
                currency: 'USD'
            }
        });

        if (coupon) {
            order.coupon = {
                code: coupon.code,
                discount: discount,
                type: coupon.type
            };
        }

        await order.save();

        // Update product stock
        for (const item of items) {
            await Product.findByIdAndUpdate(item.product, {
                $inc: { stock: -item.quantity }
            });
        }

        // Create initial status
        await OrderStatus.create({
            order: order._id,
            status: 'pending',
            changedBy: user._id,
            metadata: {
                ip: req.ip,
                userAgent: req.headers['user-agent']
            }
        });

        // Send confirmation email
        await sendOrderConfirmationEmail(user.email, order);

        res.status(201).json({
            message: 'Order created successfully',
            order,
            clientSecret: paymentMethod === 'stripe' ? await createStripePaymentIntent(order) : null
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get user's orders
exports.getUserOrders = async (req, res) => {
    try {
        const { page = 1, limit = 10, status } = req.query;
        const query = { user: req.user._id };
        
        if (status) {
            query.status = status;
        }

        const orders = await Order.find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .populate('items.product');

        const total = await Order.countDocuments(query);

        res.json({
            orders,
            totalPages: Math.ceil(total / limit),
            currentPage: page
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get order by ID
exports.getOrderById = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id)
            .populate('items.product')
            .populate('user');

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Check if user is authorized to view the order
        if (order.user._id.toString() !== req.user._id.toString() && !req.user.isAdmin) {
            return res.status(403).json({ message: 'Not authorized to view this order' });
        }

        // Get status history
        const statusHistory = await OrderStatus.find({ order: order._id })
            .sort({ createdAt: -1 })
            .populate('changedBy');

        res.json({
            order,
            statusHistory
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Update order status (admin only)
exports.updateOrderStatus = async (req, res) => {
    try {
        const { status, notes } = req.body;
        const order = await Order.findById(req.params.id);

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Update order status
        await order.updateStatus(status, notes);

        // Send status update email
        const user = await User.findById(order.user);
        await sendOrderStatusUpdateEmail(user.email, order);

        res.json({ message: 'Order status updated successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Add tracking information (admin only)
exports.addTracking = async (req, res) => {
    try {
        const { carrier, number, url } = req.body;
        const order = await Order.findById(req.params.id);

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        await order.addTracking(carrier, number, url);
        res.json({ message: 'Tracking information added successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Update tracking status (admin only)
exports.updateTracking = async (req, res) => {
    try {
        const { status, location, description } = req.body;
        const order = await Order.findById(req.params.id);

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        await order.updateTracking(status, location, description);
        res.json({ message: 'Tracking status updated successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Cancel order
exports.cancelOrder = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Check if user is authorized to cancel the order
        if (order.user.toString() !== req.user._id.toString() && !req.user.isAdmin) {
            return res.status(403).json({ message: 'Not authorized to cancel this order' });
        }

        // Check if order can be cancelled
        if (order.status !== 'pending') {
            return res.status(400).json({ message: 'Order cannot be cancelled at this stage' });
        }

        // Update order status
        await order.updateStatus('cancelled', 'Order cancelled by user');

        // Restore product stock
        for (const item of order.items) {
            await Product.findByIdAndUpdate(item.product, {
                $inc: { stock: item.quantity }
            });
        }

        res.json({ message: 'Order cancelled successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Process refund
exports.processRefund = async (req, res) => {
    try {
        const { amount, reason } = req.body;
        const order = await Order.findById(req.params.id);

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Process refund
        await order.processRefund(amount, reason);

        res.json({ message: 'Refund processed successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Helper function to create Stripe payment intent
async function createStripePaymentIntent(order) {
    const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(order.total * 100), // Convert to cents
        currency: order.payment.currency,
        metadata: {
            orderId: order._id.toString()
        }
    });

    return paymentIntent.client_secret;
} 