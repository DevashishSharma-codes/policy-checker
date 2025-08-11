const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
  fileName: {
    type: String,
    required: true
  },
  fileUrl: {
    type: String,
    required: true
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId, // This must match the type of your User _id
    ref: 'User', // 'User' should be the name of your Mongoose User model
    required: true // Make this required if every file must have an uploader
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  }
});

const File = mongoose.model('File', fileSchema);

module.exports = File;