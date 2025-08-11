const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const userModel = require('../models/user.model');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

router.get("/register", (req, res) => {
    res.render('register');
});

router.post("/register",
    body('email').trim().isEmail().isLength({ min: 13 }),
    body('password').trim().isLength({ min: 5 }),
    body('username').trim().isLength({ min: 3 }),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                errors: errors.array(),
                message: "Invalid input data"
            });
        }
        const { username, email, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await userModel.create({
            username,
            email,
            password: hashedPassword
        });

        // Create a JWT for the new user
        const token = jwt.sign({
            id: newUser._id,
            email: newUser.email,
            username: newUser.username
        }, process.env.JWT_SECRET);

        // Set the JWT as a cookie and redirect
        res.cookie('token', token);
        res.redirect('/');
    });

router.get('/login', (req, res) => {
    res.render('login');
});

router.post('/login',
    body('username').trim().isLength({ min: 3 }),
    body('password').trim().isLength({ min: 5 }),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array(), message: "Invalid input data" });
        }
        const { username, password } = req.body;
        const user = await userModel.findOne({ username });
        if (!user) {
            return res.status(401).json({ message: "Invalid username or password" });
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: "Invalid username or password" });
        }
        const token = jwt.sign({
            id: user._id,
            email: user.email,
            username: user.username
        }, process.env.JWT_SECRET);

        res.cookie('token', token);
        // Redirect to the home page after successful login
        res.redirect('/');
    });



router.get('/logout', (req, res) => {
    res.clearCookie('token'); // Clear the authentication cookie
    // You can optionally send a message before redirecting if you want to display it on the login page
    // For now, a direct redirect is cleaner.
    res.redirect('/user/login?message=logged_out'); // Redirect to login, maybe with a query param
});

module.exports = router;