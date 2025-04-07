const User = require('../models/User');
const { generateToken } = require('../middleware/auth');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

// Create email transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.NODEMAILER_USER,
        pass: process.env.NODEMAILER_PASS
    }
});

// Register a new user
exports.register = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        // Create new user
        const user = new User({ name, email, password });
        await user.save();

        // Generate verification token
        const token = user.generateEmailVerificationToken();
        await user.save();

        // Send verification email
        const verificationUrl = `${process.env.CLIENT_URL}/verify-email?token=${token}`;
        await transporter.sendMail({
            to: email,
            subject: 'Verify your email',
            html: `
                <h1>Welcome to RCPlanet!</h1>
                <p>Please click the link below to verify your email:</p>
                <a href="${verificationUrl}">Verify Email</a>
            `
        });

        // Generate auth token
        const authToken = generateToken(user._id);

        res.status(201).json({ user, token: authToken });
    } catch (error) {
        res.status(400).json({ error: 'Error registering user' });
    }
};

// Login user
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Find user
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Check password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate token
        const token = generateToken(user._id);

        res.json({ user, token });
    } catch (error) {
        res.status(400).json({ error: 'Error logging in' });
    }
};

// Get user profile
exports.getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user._id)
            .select('-password')
            .populate('wishlist')
            .populate('orders');
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching profile' });
    }
};

// Update user profile
exports.updateProfile = async (req, res) => {
    try {
        const updates = Object.keys(req.body);
        const allowedUpdates = ['name', 'email', 'password', 'address', 'phone'];
        const isValidOperation = updates.every(update => allowedUpdates.includes(update));

        if (!isValidOperation) {
            return res.status(400).json({ error: 'Invalid updates' });
        }

        const user = await User.findById(req.user._id);
        updates.forEach(update => user[update] = req.body[update]);
        await user.save();

        res.json(user);
    } catch (error) {
        res.status(400).json({ error: 'Error updating profile' });
    }
};

// Forgot password
exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Generate reset token
        const token = user.generateResetPasswordToken();
        await user.save();

        // Send reset email
        const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${token}`;
        await transporter.sendMail({
            to: email,
            subject: 'Password Reset',
            html: `
                <h1>Password Reset Request</h1>
                <p>Click the link below to reset your password:</p>
                <a href="${resetUrl}">Reset Password</a>
                <p>This link will expire in 1 hour.</p>
            `
        });

        res.json({ message: 'Password reset email sent' });
    } catch (error) {
        res.status(500).json({ error: 'Error processing forgot password' });
    }
};

// Reset password
exports.resetPassword = async (req, res) => {
    try {
        const { token, password } = req.body;
        const user = await User.findOne({
            resetPasswordToken: token,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ error: 'Invalid or expired token' });
        }

        user.password = password;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        res.json({ message: 'Password reset successful' });
    } catch (error) {
        res.status(400).json({ error: 'Error resetting password' });
    }
};

// Verify email
exports.verifyEmail = async (req, res) => {
    try {
        const { token } = req.params;
        const user = await User.findOne({ emailVerificationToken: token });

        if (!user) {
            return res.status(400).json({ error: 'Invalid token' });
        }

        user.isEmailVerified = true;
        user.emailVerificationToken = undefined;
        await user.save();

        res.json({ message: 'Email verified successfully' });
    } catch (error) {
        res.status(400).json({ error: 'Error verifying email' });
    }
};

// Add to wishlist
exports.addToWishlist = async (req, res) => {
    try {
        const { productId } = req.params;
        const user = await User.findById(req.user._id);

        if (user.wishlist.includes(productId)) {
            return res.status(400).json({ error: 'Product already in wishlist' });
        }

        user.wishlist.push(productId);
        await user.save();

        res.json({ message: 'Product added to wishlist' });
    } catch (error) {
        res.status(400).json({ error: 'Error adding to wishlist' });
    }
};

// Remove from wishlist
exports.removeFromWishlist = async (req, res) => {
    try {
        const { productId } = req.params;
        const user = await User.findById(req.user._id);

        user.wishlist = user.wishlist.filter(id => id.toString() !== productId);
        await user.save();

        res.json({ message: 'Product removed from wishlist' });
    } catch (error) {
        res.status(400).json({ error: 'Error removing from wishlist' });
    }
}; 