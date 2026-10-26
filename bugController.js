const path = require('path');
const fs = require('fs');
const db = require('../database/db');
const { BUGS_DIR } = require('../middleware/upload');

async function getBugs(req, res) {
  try {
    const bugs = await db.getAllBugs();
    return res.json({ success: true, bugs });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function createBug(req, res) {
  try {
    const { title, category, severity, status, description } = req.body;
    const internId = req.user.role === 'ADMIN' ? (req.body.internId || req.user.id) : req.user.id;

    if (!title) {
      return res.status(400).json({ success: false, message: 'Bug title is required.' });
    }

    let hasDocument = false;
    let documentName = '';
    let documentPath = '';
    let documentSize = '';

    if (req.file) {
      hasDocument = true;
      documentName = req.file.originalname;
      documentPath = req.file.filename;
      documentSize = (req.file.size / (1024 * 1024)).toFixed(2) + ' MB';
    }

    const bug = await db.createBug({
      intern_id: internId,
      title: title.trim(),
      category: category || 'Firmware',
      severity: severity || 'Major',
      status: status || 'Resolved',
      description: description || '',
      has_document: hasDocument,
      document_name: documentName,
      document_path: documentPath,
      document_size: documentSize
    });

    return res.status(201).json({
      success: true,
      message: 'Bug documented towards weekly 10-bug quota! 🐞',
      bug
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function toggleBugStatus(req, res) {
  try {
    const { id } = req.params;
    const bug = await db.getBugById(id);
    if (!bug) {
      return res.status(404).json({ success: false, message: 'Bug record not found.' });
    }

    const nextStatus = bug.status === 'Resolved' ? 'Open' : 'Resolved';
    const updated = await db.updateBug(id, { status: nextStatus });

    return res.json({
      success: true,
      message: `Bug marked as ${nextStatus}!`,
      bug: updated
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function deleteBug(req, res) {
  try {
    const { id } = req.params;
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Only Guide/Admin can delete bug records.' });
    }
    await db.deleteBug(id);
    return res.json({ success: true, message: 'Bug record deleted.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function downloadBugDoc(req, res) {
  try {
    const { id } = req.params;
    const bug = await db.getBugById(id);
    if (!bug || !bug.documentPath) {
      return res.status(404).json({ success: false, message: 'No bug document attached.' });
    }

    const filePath = path.join(BUGS_DIR, bug.documentPath);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'Bug document file not found on server storage.' });
    }

    return res.download(filePath, bug.documentName);
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  getBugs,
  createBug,
  toggleBugStatus,
  deleteBug,
  downloadBugDoc
};
