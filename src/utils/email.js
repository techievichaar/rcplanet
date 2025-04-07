const nodemailer = require('nodemailer');
const ejs = require('ejs');
const path = require('path');
const fs = require('fs');

// Create reusable transporter object using SMTP transport
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

// Read email templates
const templates = {
    orderConfirmation: fs.readFileSync(path.join(__dirname, '../templates/emails/order-confirmation.ejs'), 'utf8'),
    orderStatusUpdate: fs.readFileSync(path.join(__dirname, '../templates/emails/order-status-update.ejs'), 'utf8'),
    orderShipped: fs.readFileSync(path.join(__dirname, '../templates/emails/order-shipped.ejs'), 'utf8'),
    orderDelivered: fs.readFileSync(path.join(__dirname, '../templates/emails/order-delivered.ejs'), 'utf8'),
    orderCancelled: fs.readFileSync(path.join(__dirname, '../templates/emails/order-cancelled.ejs'), 'utf8'),
    refundProcessed: fs.readFileSync(path.join(__dirname, '../templates/emails/refund-processed.ejs'), 'utf8')
};

// Helper function to send email
async function sendEmail(to, subject, html) {
    try {
        const info = await transporter.sendMail({
            from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM_ADDRESS}>`,
            to,
            subject,
            html
        });
        return info;
    } catch (error) {
        console.error('Error sending email:', error);
        throw error;
    }
}

// Send order confirmation email
exports.sendOrderConfirmationEmail = async (email, order) => {
    try {
        const html = ejs.render(templates.orderConfirmation, {
            order,
            orderNumber: order.orderNumber,
            items: order.items,
            subtotal: order.subtotal,
            shipping: order.shipping,
            tax: order.tax,
            total: order.total,
            coupon: order.coupon,
            date: order.createdAt.toLocaleDateString(),
            trackingUrl: `${process.env.FRONTEND_URL}/orders/${order._id}`
        });

        await sendEmail(
            email,
            `Order Confirmation - #${order.orderNumber}`,
            html
        );
    } catch (error) {
        console.error('Error sending order confirmation email:', error);
        throw error;
    }
};

// Send order status update email
exports.sendOrderStatusUpdateEmail = async (email, order) => {
    try {
        const html = ejs.render(templates.orderStatusUpdate, {
            order,
            orderNumber: order.orderNumber,
            status: order.status,
            date: new Date().toLocaleDateString(),
            trackingUrl: `${process.env.FRONTEND_URL}/orders/${order._id}`
        });

        await sendEmail(
            email,
            `Order Status Update - #${order.orderNumber}`,
            html
        );
    } catch (error) {
        console.error('Error sending order status update email:', error);
        throw error;
    }
};

// Send order shipped email
exports.sendOrderShippedEmail = async (email, order) => {
    try {
        const html = ejs.render(templates.orderShipped, {
            order,
            orderNumber: order.orderNumber,
            tracking: order.shipping.tracking,
            estimatedDelivery: order.shipping.estimatedDelivery,
            trackingUrl: `${process.env.FRONTEND_URL}/orders/${order._id}`
        });

        await sendEmail(
            email,
            `Your Order Has Shipped - #${order.orderNumber}`,
            html
        );
    } catch (error) {
        console.error('Error sending order shipped email:', error);
        throw error;
    }
};

// Send order delivered email
exports.sendOrderDeliveredEmail = async (email, order) => {
    try {
        const html = ejs.render(templates.orderDelivered, {
            order,
            orderNumber: order.orderNumber,
            deliveryDate: new Date().toLocaleDateString(),
            reviewUrl: `${process.env.FRONTEND_URL}/products/${order.items[0].product}/review`
        });

        await sendEmail(
            email,
            `Your Order Has Been Delivered - #${order.orderNumber}`,
            html
        );
    } catch (error) {
        console.error('Error sending order delivered email:', error);
        throw error;
    }
};

// Send order cancelled email
exports.sendOrderCancelledEmail = async (email, order) => {
    try {
        const html = ejs.render(templates.orderCancelled, {
            order,
            orderNumber: order.orderNumber,
            cancellationDate: new Date().toLocaleDateString(),
            reason: order.notes?.admin || 'Order cancelled by customer'
        });

        await sendEmail(
            email,
            `Order Cancelled - #${order.orderNumber}`,
            html
        );
    } catch (error) {
        console.error('Error sending order cancelled email:', error);
        throw error;
    }
};

// Send refund processed email
exports.sendRefundProcessedEmail = async (email, order, refund) => {
    try {
        const html = ejs.render(templates.refundProcessed, {
            order,
            orderNumber: order.orderNumber,
            refund,
            refundAmount: refund.amount,
            refundDate: new Date().toLocaleDateString(),
            refundMethod: refund.paymentMethod
        });

        await sendEmail(
            email,
            `Refund Processed - #${order.orderNumber}`,
            html
        );
    } catch (error) {
        console.error('Error sending refund processed email:', error);
        throw error;
    }
}; 