const jwt = require('jsonwebtoken');
const User = require('../models/user.model'); // Ensure this path is correct

const protect = async (req, res, next) => {
    const token = req.cookies.token;

    if (!token) {
        // If there's no token, we can't find a user.
        // We'll proceed without a user and let the route handle it.
        req.user = null;
        return next();
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select('-password');

        if (!user) {
            req.user = null; // User from token not found
            return next();
        }

        req.user = user; // User is found, attach to request
        next();
    } catch (error) {
        // Token is invalid, expired, etc.
        console.error('Token verification failed:', error);
        req.user = null;
        next();
    }
};

const requireAuth = async (req, res, next) => {
    // This middleware is for routes that absolutely require authentication.
    const token = req.cookies.token;

    if (!token) {
        return res.status(401).redirect('/user/login');
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);

        if (!user) {
            return res.status(401).redirect('/user/login');
        }

        req.user = user;
        next();
    } catch (error) {
        res.status(401).redirect('/user/login');
    }
};

module.exports = { protect, requireAuth };