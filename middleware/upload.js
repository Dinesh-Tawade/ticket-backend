const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload directories exist
const ensureDirectoryExists = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let folder = 'uploads/';
    
    // Determine folder based on file type or user role
    if (file.fieldname === 'profileImage') {
      folder += 'profiles/';
    } else if (file.fieldname === 'theaterImage') {
      folder += 'theaters/';
    } else if (file.fieldname === 'productImage' || file.fieldname === 'image') {
      folder += 'products/';
    } else if (file.fieldname === 'storeLogo') {
      folder += 'vendor/logos/';
    } else if (file.fieldname === 'moviePoster') {
      folder += 'movies/';
    } else if (file.fieldname === 'screenImage') {
      folder += 'screens/';
    } else {
      folder += 'misc/';
    }
    
    ensureDirectoryExists(folder);
    cb(null, folder);
  },
  filename: (req, file, cb) => {
    // Create unique filename: timestamp-randomnumber-originalname
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    // Remove spaces from fieldname and originalname
    const cleanFieldName = file.fieldname.replace(/\s/g, '');
    const cleanOriginalName = path.basename(file.originalname, ext).replace(/\s/g, '_');
    cb(null, cleanFieldName + '-' + uniqueSuffix + ext);
  }
});

// File filter
const fileFilter = (req, file, cb) => {
  const allowedFileTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedFileTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedFileTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only image files (jpeg, jpg, png, gif, webp) are allowed!'));
  }
};

// Create multer instance
const upload = multer({
  storage: storage,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5242880 }, // 5MB default
  fileFilter: fileFilter
});

// Single file upload (Generic)
const uploadSingle = (fieldName) => upload.single(fieldName);

// Multiple files upload
const uploadMultiple = (fields) => upload.fields(fields);

// Specific upload handlers for common fields
const uploadProfileImage = upload.single('profileImage');
const uploadStoreLogo = upload.single('storeLogo');
const uploadProductImage = upload.single('image');
const uploadMoviePoster = upload.single('poster');

module.exports = { 
  uploadSingle, 
  uploadMultiple, 
  upload,
  uploadProfileImage,
  uploadStoreLogo,
  uploadProductImage,
  uploadMoviePoster
};