const mongoose = require('mongoose');
const dbURL = process.env.ATLAS_URI; 
function connectDb(){
    mongoose.connect(dbURL)
    .then(()=>{
        console.log('Data base connected')
    });
}

module.exports = connectDb;