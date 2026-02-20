const express = require('express');
const multer = require('multer');
const questionUploadController = require('../controllers/questionUploadController');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    const ok = file.mimetype === 'text/csv' || file.originalname.toLowerCase().endsWith('.csv');
    if (ok) cb(null, true);
    else cb(new Error('Only CSV files are allowed'), false);
  },
});

router.post('/upload-csv', (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'File size must not exceed 2MB' });
      return res.status(400).json({ error: err.message || 'File upload failed' });
    }
    questionUploadController.uploadCsv(req, res).catch(next);
  });
});

module.exports = router;
