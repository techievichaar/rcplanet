const axios = require('axios');

// Tax calculation based on address
exports.calculateTax = async (subtotal, address) => {
    try {
        // Get tax rate from tax API based on address
        const response = await axios.get(`${process.env.TAX_API_URL}/rates`, {
            params: {
                country: address.country,
                state: address.state,
                city: address.city,
                zip: address.zipCode
            },
            headers: {
                'Authorization': `Bearer ${process.env.TAX_API_KEY}`
            }
        });

        const taxRate = response.data.rate || process.env.DEFAULT_TAX_RATE || 0.08; // 8% default
        return subtotal * taxRate;
    } catch (error) {
        console.error('Error calculating tax:', error);
        // Fallback to default tax rate
        return subtotal * (process.env.DEFAULT_TAX_RATE || 0.08);
    }
};

// Shipping cost calculation based on address and order details
exports.calculateShippingCost = async (address, items = [], weight = 0) => {
    try {
        // Get shipping rates from shipping API
        const response = await axios.get(`${process.env.SHIPPING_API_URL}/rates`, {
            params: {
                from_country: process.env.SHIPPING_FROM_COUNTRY,
                from_state: process.env.SHIPPING_FROM_STATE,
                from_city: process.env.SHIPPING_FROM_CITY,
                from_zip: process.env.SHIPPING_FROM_ZIP,
                to_country: address.country,
                to_state: address.state,
                to_city: address.city,
                to_zip: address.zipCode,
                weight: weight || calculateTotalWeight(items),
                value: calculateTotalValue(items)
            },
            headers: {
                'Authorization': `Bearer ${process.env.SHIPPING_API_KEY}`
            }
        });

        // Get the cheapest shipping rate
        const rates = response.data.rates || [];
        const cheapestRate = rates.reduce((min, rate) => 
            rate.amount < min.amount ? rate : min, rates[0]);

        return cheapestRate ? cheapestRate.amount : process.env.DEFAULT_SHIPPING_COST || 10;
    } catch (error) {
        console.error('Error calculating shipping cost:', error);
        // Fallback to default shipping cost
        return process.env.DEFAULT_SHIPPING_COST || 10;
    }
};

// Helper function to calculate total weight of items
function calculateTotalWeight(items) {
    return items.reduce((total, item) => {
        return total + (item.weight || 0) * item.quantity;
    }, 0);
}

// Helper function to calculate total value of items
function calculateTotalValue(items) {
    return items.reduce((total, item) => {
        return total + item.price * item.quantity;
    }, 0);
}

// Calculate estimated delivery date
exports.calculateEstimatedDelivery = async (address, shippingMethod = 'standard') => {
    try {
        const response = await axios.get(`${process.env.SHIPPING_API_URL}/delivery-estimate`, {
            params: {
                from_country: process.env.SHIPPING_FROM_COUNTRY,
                from_state: process.env.SHIPPING_FROM_STATE,
                from_city: process.env.SHIPPING_FROM_CITY,
                from_zip: process.env.SHIPPING_FROM_ZIP,
                to_country: address.country,
                to_state: address.state,
                to_city: address.city,
                to_zip: address.zipCode,
                method: shippingMethod
            },
            headers: {
                'Authorization': `Bearer ${process.env.SHIPPING_API_KEY}`
            }
        });

        return new Date(response.data.estimated_delivery);
    } catch (error) {
        console.error('Error calculating estimated delivery:', error);
        // Fallback to default delivery estimate (5-7 business days)
        const date = new Date();
        date.setDate(date.getDate() + 7);
        return date;
    }
};

// Calculate order total with all fees
exports.calculateOrderTotal = async (subtotal, address, items, coupon = null) => {
    const tax = await exports.calculateTax(subtotal, address);
    const shipping = await exports.calculateShippingCost(address, items);
    
    let discount = 0;
    if (coupon) {
        if (coupon.type === 'percentage') {
            discount = (subtotal * coupon.discount) / 100;
        } else {
            discount = coupon.discount;
        }
    }

    return {
        subtotal,
        tax,
        shipping,
        discount,
        total: subtotal + tax + shipping - discount
    };
}; 