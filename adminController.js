const { bcrypt } = require('../utils/security');
const db = require('../database/db');

async function getAllInterns(req, res) {
  try {
    const interns = await db.getAllInterns();
    const tasks = await db.getAllTasks();
    const submissions = await db.getAllSubmissions();
    const bugs = await db.getAllBugs();

    // Map metrics for each intern for leaderboard & performance analytics
    const populated = interns.map(intern => {
      const { password_hash, ...safeIntern } = intern;
      const internTasks = tasks.filter(t => t.internId === intern.id);
      const tasksDone = internTasks.filter(t => t.type === 'Task' && (t.status === 'Task Completed' || t.status === 'Completed')).length;
      const assessmentsDone = internTasks.filter(t => t.type === 'Assessment' && (t.status === 'Assessment Completed' || t.status === 'Completed')).length;
      const internSubs = submissions.filter(s => s.internId === intern.id);
      const internBugs = bugs.filter(b => b.internId === intern.id);

      return {
        ...safeIntern,
        password: intern.plain_password || intern.password || '',
        plain_password: intern.plain_password || intern.password || '',
        tasksCount: internTasks.length,
        tasksDone,
        assessmentsDone,
        submissionsCount: internSubs.length,
        bugsCount: internBugs.length,
        score: (tasksDone * 1) + (assessmentsDone * 2) + (internBugs.length * 1) + (internSubs.length * 1)
      };
    });

    return res.json({
      success: true,
      interns: populated
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function createIntern(req, res) {
  try {
    const {
      name,
      username,
      password,
      domain,
      status,
      college,
      department,
      year,
      email,
      phone,
      duration,
      tasks
    } = req.body;

    if (!name || !username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, username, and password are required.'
      });
    }

    const cleanUsername = username.trim().toLowerCase();

    // Check if username already exists
    const existing = await db.findUserByUsername(cleanUsername);
    if (existing) {
      return res.status(400).json({
        success: false,
        message: `Username '${cleanUsername}' is already taken. Please choose another.`
      });
    }

    // Securely hash password with bcrypt
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password.trim(), salt);

    const avatarGradients = [
      'avatar-gradient-1', 'avatar-gradient-2', 'avatar-gradient-3',
      'avatar-gradient-4', 'avatar-gradient-5', 'avatar-gradient-6'
    ];
    const randomAvatar = avatarGradients[Math.floor(Math.random() * avatarGradients.length)];

    const internId = 'int-' + Date.now();

    const created = await db.createUser({
      id: internId,
      role: 'INTERN',
      name: name.trim(),
      username: cleanUsername,
      password_hash,
      plain_password: password.trim(),
      domain: domain ? domain.trim() : 'Embedded & IoT',
      status: status || 'Active',
      college: college ? college.trim() : '',
      department: department ? department.trim() : '',
      year: year ? year.trim() : '3rd Year',
      email: email ? email.trim() : '',
      phone: phone ? phone.trim() : '',
      duration: duration || '3 Months',
      guide: 'Palani Pandi C',
      joined_date: new Date().toISOString().split('T')[0],
      avatar_bg: randomAvatar
    });

    // Create initial tasks if provided
    if (tasks && Array.isArray(tasks)) {
      for (const taskTitle of tasks) {
        if (taskTitle && taskTitle.trim()) {
          await db.createTask({
            intern_id: internId,
            type: 'Task',
            title: taskTitle.trim(),
            description: '',
            priority: 'Normal',
            status: 'In Progress',
            due_date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]
          });
        }
      }
    }

    const { password_hash: _, ...safeIntern } = created;

    return res.status(201).json({
      success: true,
      message: `Intern ${name} created successfully!`,
      intern: safeIntern
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function updateIntern(req, res) {
  try {
    const { id } = req.params;
    const {
      name,
      username,
      password,
      domain,
      status,
      college,
      department,
      year,
      email,
      phone,
      duration
    } = req.body;

    const existing = await db.findUserById(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Intern not found.' });
    }

    const updates = {};
    if (name) updates.name = name.trim();
    if (username) {
      const cleanUsername = username.trim().toLowerCase();
      if (cleanUsername !== existing.username) {
        const taken = await db.findUserByUsername(cleanUsername);
        if (taken) {
          return res.status(400).json({ success: false, message: 'Username already taken.' });
        }
        updates.username = cleanUsername;
      }
    }
    if (password && password.trim()) {
      const salt = await bcrypt.genSalt(10);
      updates.password_hash = await bcrypt.hash(password.trim(), salt);
      updates.plain_password = password.trim();
    }
    if (domain !== undefined) updates.domain = domain;
    if (status !== undefined) updates.status = status;
    if (college !== undefined) updates.college = college;
    if (department !== undefined) updates.department = department;
    if (year !== undefined) updates.year = year;
    if (email !== undefined) updates.email = email;
    if (phone !== undefined) updates.phone = phone;
    if (duration !== undefined) updates.duration = duration;

    const updated = await db.updateUser(id, updates);
    const { password_hash, ...safeIntern } = updated;

    return res.json({
      success: true,
      message: 'Intern updated successfully.',
      intern: safeIntern
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function deleteIntern(req, res) {
  try {
    const { id } = req.params;
    await db.deleteUser(id);
    return res.json({
      success: true,
      message: 'Intern deleted successfully.'
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function getDashboardStats(req, res) {
  try {
    const interns = await db.getAllInterns();
    const tasks = await db.getAllTasks();
    const submissions = await db.getAllSubmissions();
    const bugs = await db.getAllBugs();
    const files = await db.getAllFiles();

    const todayStr = new Date().toISOString().split('T')[0];
    const activeToday = interns.filter(i => i.last_login_date === todayStr || i.lastLoginDate === todayStr).length;

    const regularTasksCompleted = tasks.filter(t => t.type === 'Task' && (t.status === 'Task Completed' || t.status === 'Completed')).length;
    const assessmentsCompleted = tasks.filter(t => t.type === 'Assessment' && (t.status === 'Assessment Completed' || t.status === 'Completed')).length;
    const resolvedBugs = bugs.filter(b => b.status === 'Resolved').length;

    return res.json({
      success: true,
      stats: {
        totalInterns: interns.length,
        activeToday,
        tasksCompleted: regularTasksCompleted,
        assessmentsCompleted,
        zipSubmissions: submissions.length,
        filesCount: files.length,
        resolvedBugs,
        weeklyBugQuota: 10
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function getSettings(req, res) {
  try {
    const settings = await db.getSettings();
    const adminUser = await db.findUserByUsername('palani');
    return res.json({
      success: true,
      settings: {
        ...settings,
        username: adminUser?.username || 'palani',
        name: adminUser?.name || 'Palani Pandi C',
        org: adminUser?.domain || settings?.guide_org
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function updateSettings(req, res) {
  try {
    const { name, org, username, password } = req.body;
    const adminUser = await db.findUserByUsername('palani') || await db.findUserById('sup-palani-admin');

    if (adminUser) {
      const updates = {};
      if (name) updates.name = name.trim();
      if (org) updates.domain = org.trim();
      if (username) updates.username = username.trim().toLowerCase();
      if (password && password.trim()) {
        const salt = await bcrypt.genSalt(10);
        updates.password_hash = await bcrypt.hash(password.trim(), salt);
      }
      await db.updateUser(adminUser.id, updates);
    }

    const updated = await db.updateSettings({
      guide_name: name,
      guide_org: org
    });

    return res.json({
      success: true,
      message: 'Guide settings updated successfully.',
      settings: updated
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  getAllInterns,
  createIntern,
  updateIntern,
  deleteIntern,
  getDashboardStats,
  getSettings,
  updateSettings
};
