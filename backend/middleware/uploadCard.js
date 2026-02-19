const multer = require('multer');
const path = require('path');
const fs = require('fs');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'cards');

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename: function (req, file, cb) {
    const ext = (file.originalname && path.extname(file.originalname)) || '.png';
    const safeExt = ext.toLowerCase().replace(/[^a-z0-9.]/g, '');
    const ts = Date.now();
    const random = Math.random().toString(36).slice(2, 10);
    const filename = `card-${ts}-${random}${safeExt || '.png'}`;
    cb(null, filename);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    const allowed = /^image\//.test(file.mimetype);
    if (allowed) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  }
});

module.exports = upload;
