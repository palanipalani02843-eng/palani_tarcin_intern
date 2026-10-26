const express = require('express');
const router = express.Router();
const internController = require('../controllers/internController');
const submissionController = require('../controllers/submissionController');
const { authMiddleware, requireIntern } = require('../middleware/auth');
const { uploadZip } = require('../middleware/upload');

// All intern routes require valid JWT with INTERN role
router.use(authMiddleware, requireIntern);

// Profile
router.get('/profile', internController.getProfile);

// Assigned Tasks & Assessments
router.get('/tasks', internController.getMyTasks);

// ZIP Deliverables Submissions
router.get('/submissions', internController.getMySubmissions);
router.post('/submissions', uploadZip.single('file'), submissionController.createSubmission);

// Bugs
router.get('/bugs', internController.getMyBugs);

// Daily Standup Logs
router.get('/logs', internController.getMyLogs);
router.post('/logs', internController.submitDailyLog);

module.exports = router;
