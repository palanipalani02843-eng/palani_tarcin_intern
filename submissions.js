const express = require('express');
const router = express.Router();
const submissionController = require('../controllers/submissionController');
const { authMiddleware } = require('../middleware/auth');
const { uploadZip } = require('../middleware/upload');

router.use(authMiddleware);

router.get('/', submissionController.getSubmissions);
router.post('/', uploadZip.single('file'), submissionController.createSubmission);
router.get('/:id/download', submissionController.downloadSubmission);
router.put('/:id/approve', submissionController.approveSubmission);
router.put('/:id/reject', submissionController.rejectSubmission);

module.exports = router;
