const multer = require('multer');
const path = require('path');
const fs = require('fs');

const ensureDirectoryExists = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let folder = 'uploads/';
    
    if (file.fieldname === 'profileImage') {
      folder += 'profiles/';
    } else if (file.fieldname === 'theaterImage') {
      folder += 'theaters/';
    } else if (file.fieldname === 'productImage' || file.fieldname === 'image') {
      folder += 'products/';
    } else if (file.fieldname === 'storeLogo') {
      folder += 'vendor/logos/';
    } else if (file.fieldname === 'moviePoster' || file.fieldname === 'poster') {
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
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);

    const cleanFieldName = file.fieldname.replace(/\s/g, '');
    const cleanOriginalName = path.basename(file.originalname, ext).replace(/\s/g, '_');

    cb(null, `${cleanFieldName}-${uniqueSuffix}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedFileTypes = /jpeg|jpg|png|gif|webp/;

  const extname = allowedFileTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedFileTypes.test(file.mimetype);

  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(new Error('Only image files (jpeg, jpg, png, gif, webp) are allowed!'));
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 
  },
  fileFilter: fileFilter
});

const handleUploadError = (middleware) => {
  return (req, res, next) => {
    middleware(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            message: 'File size exceeds 5MB limit'
          });
        }
        return res.status(400).json({
          success: false,
          message: err.message
        });
      } else if (err) {
        return res.status(400).json({
          success: false,
          message: err.message
        });
      }
      next();
    });
  };
};

const uploadSingle = (fieldName) => handleUploadError(upload.single(fieldName));
const uploadMultiple = (fields) => handleUploadError(upload.fields(fields));

const uploadProfileImage = handleUploadError(upload.single('profileImage'));
const uploadStoreLogo = handleUploadError(upload.single('storeLogo'));
const uploadProductImage = handleUploadError(upload.single('image'));
const uploadMoviePoster = handleUploadError(upload.single('poster'));

module.exports = {
  uploadSingle,
  uploadMultiple,
  upload,
  uploadProfileImage,
  uploadStoreLogo,
  uploadProductImage,
  uploadMoviePoster
};