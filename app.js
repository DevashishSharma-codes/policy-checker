// server.js

// 1. ALWAYS the very first line to load environment variables
require('dotenv').config();

// 2. Now you can safely require other modules that might depend on env variables
const express = require('express');
const app = express();
const userRouter = require('./routes/user.routes');
const indexRouter = require('./routes/index.routes');
const connectDb = require('./config/db');
const cookieParser = require('cookie-parser');

// 3. Your app setup
app.set('view engine', 'ejs');
app.use(cookieParser())
connectDb(); // Assuming connectDb also uses env variables, it should be safe here now
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 4. Your routes
app.use('/', indexRouter);
app.use('/user', userRouter);

app.listen(3000 , ()=>{
    console.log("server is started");
});