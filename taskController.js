const db = require('../database/db');

async function getTasks(req, res) {
  try {
    if (req.user.role === 'ADMIN') {
      const tasks = await db.getAllTasks();
      return res.json({ success: true, tasks });
    } else {
      const tasks = await db.getTasksByInternId(req.user.id);
      return res.json({ success: true, tasks });
    }
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function createTask(req, res) {
  try {
    const { internId, type, title, description, priority, dueDate, status } = req.body;

    if (!internId || !title) {
      return res.status(400).json({ success: false, message: 'Intern ID and task title are required.' });
    }

    // Intern can only create tasks for themselves (if allowed), Admin can create for anyone
    if (req.user.role !== 'ADMIN' && req.user.id !== internId) {
      return res.status(403).json({ success: false, message: 'Unauthorized to assign tasks to other interns.' });
    }

    const task = await db.createTask({
      intern_id: internId,
      type: type || 'Task',
      title: title.trim(),
      description: description || '',
      priority: priority || 'Normal',
      status: status || 'To Do',
      due_date: dueDate || new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0]
    });

    return res.status(201).json({
      success: true,
      message: `${type || 'Task'} allocated successfully!`,
      task
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function updateTask(req, res) {
  try {
    const { id } = req.params;
    const { status, title, description, priority, dueDate } = req.body;

    // Check if task exists and authorization
    const tasks = await db.getAllTasks();
    const task = tasks.find(t => t.id === id);

    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found.' });
    }

    if (req.user.role !== 'ADMIN' && req.user.id !== task.internId) {
      return res.status(403).json({ success: false, message: 'Unauthorized to update another intern\'s task.' });
    }

    const updated = await db.updateTask(id, {
      status,
      title,
      description,
      priority,
      due_date: dueDate
    });

    return res.json({
      success: true,
      message: 'Task updated successfully.',
      task: updated
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function deleteTask(req, res) {
  try {
    const { id } = req.params;
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Only Admin can delete tasks.' });
    }
    await db.deleteTask(id);
    return res.json({ success: true, message: 'Task deleted successfully.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  getTasks,
  createTask,
  updateTask,
  deleteTask
};
