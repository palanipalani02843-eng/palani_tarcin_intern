const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const submissionController = require('../controllers/submissionController');
const { authMiddleware, requireAdmin } = require('../middleware/auth');

// All admin routes strictly require valid JWT with ADMIN role
router.use(authMiddleware, requireAdmin);

// Interns management
router.get('/interns', adminController.getAllInterns);
router.post('/interns', adminController.createIntern);
router.put('/interns/:id', adminController.updateIntern);
router.delete('/interns/:id', adminController.deleteIntern);

// Dashboard KPIs & stats
router.get('/stats', adminController.getDashboardStats);

// Submissions review & approval
router.get('/submissions', submissionController.getSubmissions);
router.get('/submissions/:id/download', submissionController.downloadSubmission);
router.put('/submissions/:id/approve', submissionController.approveSubmission);
router.put('/submissions/:id/reject', submissionController.rejectSubmission);

// Guide / Supervisor settings
router.get('/settings', adminController.getSettings);
router.put('/settings', adminController.updateSettings);

module.exports = router;
