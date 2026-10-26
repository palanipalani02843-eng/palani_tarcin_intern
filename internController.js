const db = require('../database/db');

async function getProfile(req, res) {
  try {
    const user = await db.findUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Intern profile not found.' });
    }
    const { password_hash, plain_password, ...safeUser } = user;
    return res.json({ success: true, intern: safeUser });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function getMyTasks(req, res) {
  try {
    const tasks = await db.getTasksByInternId(req.user.id);
    return res.json({ success: true, tasks });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function getMySubmissions(req, res) {
  try {
    const submissions = await db.getSubmissionsByInternId(req.user.id);
    return res.json({ success: true, submissions });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function getMyBugs(req, res) {
  try {
    const bugs = await db.getBugsByInternId(req.user.id);
    return res.json({ success: true, bugs });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function getMyLogs(req, res) {
  try {
    const logs = await db.getLogsByInternId(req.user.id);
    return res.json({ success: true, logs });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function submitDailyLog(req, res) {
  try {
    const { date, hours, completed, nextPlan, blocker } = req.body;
    if (!completed) {
      return res.status(400).json({ success: false, message: 'Completed work description is required.' });
    }

    const log = await db.createLog({
      intern_id: req.user.id,
      date: date || new Date().toISOString().split('T')[0],
      hours: hours || 8,
      completed,
      next_plan: nextPlan || '',
      blocker: blocker || ''
    });

    return res.status(201).json({
      success: true,
      message: 'Daily work log saved successfully.',
      log
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  getProfile,
  getMyTasks,
  getMySubmissions,
  getMyBugs,
  getMyLogs,
  submitDailyLog
};
