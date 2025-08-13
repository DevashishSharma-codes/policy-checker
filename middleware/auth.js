const jwt = require('jsonwebtoken');
const User = require('../models/user.model'); 

const protect = async (req, res, next) => {
    const token = req.cookies.token;

    if (!token) {
      
        req.user = null;
        return next();
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select('-password');

        if (!user) {
            req.user = null; 
            return next();
        }

        req.user = user; 
        next();
    } catch (error) {
       
        console.error('Token verification failed:', error);
        req.user = null;
        next();
    }
};

const requireAuth = async (req, res, next) => {
   
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