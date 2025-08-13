const mongoose = require('mongoose');
const dbURL = process.env.DB_URL || 'mongodb://0.0.0.0/drive'; // Replace with your actual DB URL
function connectDb(){
    mongoose.connect(dbURL)
    .then(()=>{
        console.log('Data base connected')
    });
}

module.exports = connectDb;