const path = require('path');
const fs = require('fs');
const db = require('../database/db');
const { FILES_DIR } = require('../middleware/upload');

/**
 * File Dashboard Controller
 * Stores & manages project ZIP files, starter kits, documentation & deliverables
 */

async function getFiles(req, res) {
  try {
    if (req.user.role === 'ADMIN') {
      const files = await db.getAllFiles();
      return res.json({ success: true, files });
    } else {
      const files = await db.getFilesByInternId(req.user.id);
      return res.json({ success: true, files });
    }
  } catch (err) {
    console.error('getFiles error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function createFile(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No .ZIP file uploaded. Please attach a valid .ZIP project archive.'
      });
    }

    const { description, taskId, taskTitle, internId, internName } = req.body;
    const file = req.file;

    // Format human-readable file size
    let sizeFormatted = '';
    if (file.size < 1024 * 1024) {
      sizeFormatted = (file.size / 1024).toFixed(1) + ' KB';
    } else {
      sizeFormatted = (file.size / (1024 * 1024)).toFixed(2) + ' MB';
    }

    // Resolve assigned intern name if an internId is given
    let resolvedInternName = internName || 'All Interns';
    if (internId && internId !== 'all') {
      const internObj = await db.findUserById(internId);
      if (internObj) {
        resolvedInternName = internObj.name;
      }
    }

    // Resolve task title if taskId is given
    let resolvedTaskTitle = taskTitle || '';
    if (taskId) {
      const allTasks = await db.getAllTasks();
      const matched = allTasks.find(t => t.id === taskId);
      if (matched) {
        resolvedTaskTitle = matched.title;
      }
    }

    const newFile = await db.createFile({
      file_name: file.originalname,
      storage_path: file.path,
      file_size: sizeFormatted,
      description: description || '',
      task_id: taskId || null,
      task_title: resolvedTaskTitle,
      intern_id: internId || 'all',
      intern_name: resolvedInternName,
      uploaded_by: req.user.id,
      uploaded_by_name: req.user.name || 'Guide Palani Pandi C'
    });

    return res.status(201).json({
      success: true,
      message: 'ZIP File uploaded to File Dashboard successfully.',
      file: newFile
    });
  } catch (err) {
    console.error('createFile error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function downloadFile(req, res) {
  try {
    const file = await db.getFileById(req.params.id);
    if (!file) {
      return res.status(404).json({ success: false, message: 'File not found in database.' });
    }

    // Authorization check: Guide can download all; Intern can download only assigned or shared files
    if (req.user.role !== 'ADMIN') {
      const isAssigned = (file.intern_id === req.user.id || file.intern_id === 'all' || !file.intern_id);
      if (!isAssigned) {
        return res.status(403).json({
          success: false,
          message: 'Access Denied: You do not have permission to download this file.'
        });
      }
    }

    const filePath = file.storage_path;
    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'Physical file not found on server storage.'
      });
    }

    return res.download(filePath, file.file_name);
  } catch (err) {
    console.error('downloadFile error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function deleteFile(req, res) {
  try {
    const file = await db.getFileById(req.params.id);
    if (!file) {
      return res.status(404).json({ success: false, message: 'File not found.' });
    }

    // Remove file from disk
    if (file.storage_path && fs.existsSync(file.storage_path)) {
      try {
        fs.unlinkSync(file.storage_path);
      } catch (e) {
        console.warn('Physical file deletion warning:', e.message);
      }
    }

    await db.deleteFile(req.params.id);

    return res.json({
      success: true,
      message: 'File removed successfully from File Dashboard.'
    });
  } catch (err) {
    console.error('deleteFile error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  getFiles,
  createFile,
  downloadFile,
  deleteFile
};
