const express = require('express');
const router = express.Router();
const fileController = require('../controllers/fileController');
const { authMiddleware, requireAdmin } = require('../middleware/auth');
const { uploadFileZip } = require('../middleware/upload');

// All file routes require authentication
router.use(authMiddleware);

// Get files (All for Admin, assigned/shared for Intern)
router.get('/', fileController.getFiles);

// Download file (Secure authorization check inside controller)
router.get('/:id/download', fileController.downloadFile);

// Guide-only operations: Upload & Delete
router.post('/', requireAdmin, uploadFileZip.single('file'), fileController.createFile);
router.delete('/:id', requireAdmin, fileController.deleteFile);

module.exports = router;
