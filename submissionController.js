const path = require('path');
const fs = require('fs');
const db = require('../database/db');
const { SUBMISSIONS_DIR } = require('../middleware/upload');

async function getSubmissions(req, res) {
  try {
    if (req.user.role === 'ADMIN') {
      const submissions = await db.getAllSubmissions();
      return res.json({ success: true, submissions });
    } else {
      const submissions = await db.getSubmissionsByInternId(req.user.id);
      return res.json({ success: true, submissions });
    }
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function createSubmission(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No .ZIP file uploaded. Please attach your project .ZIP archive.'
      });
    }

    const internId = req.user.role === 'ADMIN' ? (req.body.internId || req.user.id) : req.user.id;
    const { taskId, workTitle, type, notes } = req.body;

    const file = req.file;
    const sizeMb = (file.size / (1024 * 1024)).toFixed(2) + ' MB';
    const isAssessment = (type === 'Assessment' || type === 'Assessment Completed');

    let finalTaskId = taskId;

    // If an assessment or task is submitted directly without a prior taskId, create a matching completed task
    if (!finalTaskId) {
      const createdTask = await db.createTask({
        intern_id: internId,
        type: isAssessment ? 'Assessment' : 'Task',
        title: workTitle || 'Deliverable Submission',
        description: notes || 'Submitted directly via portal.',
        status: isAssessment ? 'Assessment Completed' : 'Task Completed',
        priority: 'High'
      });
      finalTaskId = createdTask.id;
    } else {
      // Update existing task status
      const targetStatus = isAssessment ? 'Assessment Completed' : 'Task Completed';
      await db.updateTask(finalTaskId, { status: targetStatus });
    }

    const submission = await db.createSubmission({
      intern_id: internId,
      task_id: finalTaskId,
      work_title: workTitle || file.originalname,
      type: isAssessment ? 'Assessment' : 'Task',
      file_name: file.originalname,
      file_path: file.filename, // Stored in server/uploads/submissions/
      file_size: sizeMb,
      submitted_at: new Date().toLocaleString(),
      status: 'Under Review',
      notes: notes || ''
    });

    return res.status(201).json({
      success: true,
      message: 'Work .ZIP deliverable uploaded and submitted successfully! 🚀',
      submission
    });
  } catch (err) {
    console.error('Submission upload error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function downloadSubmission(req, res) {
  try {
    const { id } = req.params;
    const submission = await db.getSubmissionById(id);

    if (!submission) {
      return res.status(404).json({ success: false, message: 'Submission record not found.' });
    }

    // Role-based security check: Admin can download all; Intern can only download their own
    if (req.user.role !== 'ADMIN' && req.user.id !== submission.internId) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. You do not have permission to download another intern\'s private files.'
      });
    }

    const filePath = path.join(SUBMISSIONS_DIR, submission.filePath);

    if (!fs.existsSync(filePath)) {
      // If legacy mock or deleted file, generate an informative zip/text payload
      res.setHeader('Content-Disposition', `attachment; filename="${submission.fileName}"`);
      res.setHeader('Content-Type', 'application/zip');
      return res.send(Buffer.from(`Palani Interns Workflow - Deliverable Archive\nWork: ${submission.workTitle}\nFile: ${submission.fileName}\nStatus: ${submission.status}\n`));
    }

    return res.download(filePath, submission.fileName);
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function approveSubmission(req, res) {
  try {
    const { id } = req.params;
    const { adminComment } = req.body;

    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Only Guide/Admin can approve submissions.' });
    }

    const updated = await db.updateSubmissionStatus(id, 'Approved', adminComment || 'Approved by Guide Palani Pandi C');
    return res.json({
      success: true,
      message: 'Submission approved successfully! ✓',
      submission: updated
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function rejectSubmission(req, res) {
  try {
    const { id } = req.params;
    const { adminComment } = req.body;

    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Only Guide/Admin can review submissions.' });
    }

    const updated = await db.updateSubmissionStatus(id, 'Rejected', adminComment || 'Needs revision. Contact Guide Palani Pandi C.');
    return res.json({
      success: true,
      message: 'Submission marked as needing revision.',
      submission: updated
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  getSubmissions,
  createSubmission,
  downloadSubmission,
  approveSubmission,
  rejectSubmission
};
