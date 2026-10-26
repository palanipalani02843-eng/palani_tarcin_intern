/**
 * Central Database Adapter
 * Supports:
 *  1. Supabase Client (@supabase/supabase-js) via SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 *  2. Direct PostgreSQL Pool (pg) via DATABASE_URL
 *  3. Local Persistent Store (server/data/db.json) for instant offline / local development fallback
 */

const fs = require('fs');
const path = require('path');
const { bcrypt } = require('../utils/security');

let supabaseClient = null;
let pgPool = null;
let dbMode = 'local'; // 'supabase', 'postgres', or 'local'

// Path to local data file
const isVercel = !!process.env.VERCEL;
const DATA_DIR = isVercel ? path.join('/tmp', 'tarcin_data') : path.join(__dirname, '..', 'data');
const LOCAL_DB_FILE = path.join(DATA_DIR, 'db.json');
const SEED_DB_FILE = path.join(__dirname, '..', 'data', 'db.json');

// Ensure data directory exists
try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (isVercel && !fs.existsSync(LOCAL_DB_FILE) && fs.existsSync(SEED_DB_FILE)) {
    fs.copyFileSync(SEED_DB_FILE, LOCAL_DB_FILE);
  }
} catch (e) {
  console.warn('Data directory note:', e.message);
}

// Default initial state
function getDefaultData() {
  const salt = bcrypt.genSaltSync(10);
  const adminPasswordHash = bcrypt.hashSync('123456', salt);

  return {
    users: [
      {
        id: 'sup-palani-admin',
        role: 'ADMIN',
        name: 'Palani Pandi C',
        username: 'palani',
        password_hash: adminPasswordHash,
        plain_password: '123456',
        domain: 'Embedded Systems & IoT Engineering',
        status: 'Active',
        college: 'Tarcin Robotics LLP',
        department: 'Embedded & IoT Lab',
        year: 'Guide',
        email: 'palani@tarcinrobotics.in',
        phone: '',
        duration: 'Permanent',
        guide: 'Palani Pandi C',
        joined_date: '2026-01-01',
        last_login_date: '',
        last_login_time: '',
        avatar_bg: 'avatar-gradient-1',
        created_at: new Date().toISOString()
      }
    ],
    tasks: [],
    submissions: [],
    files: [],
    bugs: [],
    daily_logs: [],
    settings: {
      id: 'app_settings',
      guide_name: 'Palani Pandi C',
      guide_org: 'Embedded & IoT Engineer working at Tarcin Robotics LLP',
      weekly_bug_quota: 10,
      updated_at: new Date().toISOString()
    }
  };
}

// Local file helper
function readLocalDB() {
  try {
    if (!fs.existsSync(LOCAL_DB_FILE)) {
      if (fs.existsSync(SEED_DB_FILE)) {
        try {
          const rawSeed = fs.readFileSync(SEED_DB_FILE, 'utf-8');
          const seedData = JSON.parse(rawSeed);
          writeLocalDB(seedData);
          return seedData;
        } catch (_) {}
      }
      const initial = getDefaultData();
      writeLocalDB(initial);
      return initial;
    }
    const raw = fs.readFileSync(LOCAL_DB_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading local DB, initializing default:', err.message);
    const initial = getDefaultData();
    writeLocalDB(initial);
    return initial;
  }
}

function writeLocalDB(data) {
  try {
    fs.writeFileSync(LOCAL_DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing local DB:', err.message);
  }
}

// Initialize database connection
async function initDB() {
  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY)?.trim();
  const dbUrl = process.env.DATABASE_URL?.trim();

  if (supabaseUrl && supabaseKey) {
    try {
      const { createClient } = require('@supabase/supabase-js');
      supabaseClient = createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false }
      });
      dbMode = 'supabase';
      console.log('⚡ Connected to Supabase at:', supabaseUrl);
      await seedSupabaseAdmin();
      return;
    } catch (err) {
      console.error('Failed to initialize Supabase client:', err.message);
    }
  }

  if (dbUrl) {
    try {
      const { Pool } = require('pg');
      pgPool = new Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
      await pgPool.query('SELECT NOW()');
      dbMode = 'postgres';
      console.log('⚡ Connected to PostgreSQL Database');
      return;
    } catch (err) {
      console.error('Failed to connect to PostgreSQL, falling back to local store:', err.message);
    }
  }

  // Fallback to local store
  dbMode = 'local';
  console.log('⚡ Running with Central Local Persistent Storage (server/data/db.json)');
  console.log('ℹ️  To connect to cloud Supabase, fill SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in server/.env');
  readLocalDB(); // Ensure initialized
}

// Seed admin in Supabase if not present
async function seedSupabaseAdmin() {
  if (dbMode !== 'supabase' || !supabaseClient) return;
  try {
    const { data, error } = await supabaseClient
      .from('users')
      .select('id')
      .eq('username', 'palani')
      .maybeSingle();

    if (!data) {
      const salt = bcrypt.genSaltSync(10);
      const hash = bcrypt.hashSync('123456', salt);
      await supabaseClient.from('users').insert({
        id: 'sup-palani-admin',
        role: 'ADMIN',
        name: 'Palani Pandi C',
        username: 'palani',
        password_hash: hash,
        plain_password: '123456',
        domain: 'Embedded Systems & IoT Engineering',
        status: 'Active',
        college: 'Tarcin Robotics LLP',
        department: 'Embedded & IoT Lab',
        year: 'Guide',
        email: 'palani@tarcinrobotics.in',
        guide: 'Palani Pandi C',
        joined_date: '2026-01-01'
      });
      console.log('✅ Default Admin account seeded in Supabase: palani / 123456');
    }
  } catch (err) {
    console.error('Supabase admin seeding warning (table might need to be created via schema.sql):', err.message);
  }
}

// ================= USER OPERATIONS =================

async function findUserByUsername(username) {
  if (!username) return null;
  const clean = username.trim().toLowerCase();
  const cleanNoDigits = clean.replace(/\d+/g, '');

  if (dbMode === 'supabase') {
    const { data, error } = await supabaseClient
      .from('users')
      .select('*')
      .ilike('username', clean)
      .maybeSingle();
    if (error && error.code !== 'PGRST116') throw error;
    if (data) return data;
  }

  if (dbMode === 'postgres') {
    const res = await pgPool.query('SELECT * FROM users WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($1)', [clean]);
    if (res.rows[0]) return res.rows[0];
  }

  const local = readLocalDB();
  // 1. Exact match on username, email, or id
  let matched = local.users.find(u => {
    const uname = (u.username || '').toLowerCase();
    const uemail = (u.email || '').toLowerCase();
    const uid = (u.id || '').toLowerCase();
    return uname === clean || uemail === clean || uid === clean;
  });
  if (matched) return matched;

  // 2. Fuzzy match stripping trailing digits (e.g. 'meenakshi' matches 'meenakshi14' or vice versa)
  if (cleanNoDigits && cleanNoDigits.length >= 3) {
    matched = local.users.find(u => {
      const uname = (u.username || '').toLowerCase();
      const unameNoDigits = uname.replace(/\d+/g, '');
      return unameNoDigits === cleanNoDigits;
    });
    if (matched) return matched;
  }

  // 3. Match by intern first name
  matched = local.users.find(u => {
    const firstName = (u.name || '').trim().toLowerCase().split(' ')[0];
    return firstName && (firstName === clean || firstName === cleanNoDigits);
  });

  return matched || null;
}

async function findUserById(id) {
  if (dbMode === 'supabase') {
    const { data, error } = await supabaseClient
      .from('users')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  if (dbMode === 'postgres') {
    const res = await pgPool.query('SELECT * FROM users WHERE id = $1', [id]);
    return res.rows[0] || null;
  }

  const local = readLocalDB();
  return local.users.find(u => u.id === id) || null;
}

async function getAllInterns() {
  if (dbMode === 'supabase') {
    const { data, error } = await supabaseClient
      .from('users')
      .select('*')
      .eq('role', 'INTERN')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  if (dbMode === 'postgres') {
    const res = await pgPool.query("SELECT * FROM users WHERE role = 'INTERN' ORDER BY created_at DESC");
    return res.rows;
  }

  const local = readLocalDB();
  return local.users.filter(u => u.role === 'INTERN');
}

async function createUser(userData) {
  const newUser = {
    id: userData.id || ('int-' + Date.now()),
    role: userData.role || 'INTERN',
    name: userData.name,
    username: userData.username.trim().toLowerCase(),
    password_hash: userData.password_hash,
    plain_password: userData.plain_password || userData.password || '',
    domain: userData.domain || 'Embedded & IoT',
    status: userData.status || 'Active',
    college: userData.college || '',
    department: userData.department || '',
    year: userData.year || '3rd Year',
    email: userData.email || '',
    phone: userData.phone || '',
    duration: userData.duration || '3 Months',
    guide: userData.guide || 'Palani Pandi C',
    joined_date: userData.joined_date || new Date().toISOString().split('T')[0],
    last_login_date: '',
    last_login_time: '',
    avatar_bg: userData.avatar_bg || 'avatar-gradient-1',
    created_at: new Date().toISOString()
  };

  if (dbMode === 'supabase') {
    const { data, error } = await supabaseClient.from('users').insert(newUser).select().single();
    if (error) throw error;
    return data;
  }

  if (dbMode === 'postgres') {
    const fields = Object.keys(newUser);
    const values = Object.values(newUser);
    const placeholders = fields.map((_, i) => `$${i + 1}`).join(', ');
    const query = `INSERT INTO users (${fields.join(', ')}) VALUES (${placeholders}) RETURNING *`;
    const res = await pgPool.query(query, values);
    return res.rows[0];
  }

  const local = readLocalDB();
  local.users.unshift(newUser);
  writeLocalDB(local);
  return newUser;
}

async function updateUser(id, updateData) {
  if (dbMode === 'supabase') {
    const { data, error } = await supabaseClient
      .from('users')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  if (dbMode === 'postgres') {
    const keys = Object.keys(updateData);
    const values = Object.values(updateData);
    const setClause = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
    const res = await pgPool.query(`UPDATE users SET ${setClause} WHERE id = $1 RETURNING *`, [id, ...values]);
    return res.rows[0];
  }

  const local = readLocalDB();
  const idx = local.users.findIndex(u => u.id === id);
  if (idx !== -1) {
    local.users[idx] = { ...local.users[idx], ...updateData };
    writeLocalDB(local);
    return local.users[idx];
  }
  return null;
}

async function deleteUser(id) {
  if (dbMode === 'supabase') {
    await supabaseClient.from('submissions').delete().eq('intern_id', id);
    await supabaseClient.from('tasks').delete().eq('intern_id', id);
    await supabaseClient.from('bugs').delete().eq('intern_id', id);
    await supabaseClient.from('daily_logs').delete().eq('intern_id', id);
    const { error } = await supabaseClient.from('users').delete().eq('id', id);
    if (error) throw error;
    return true;
  }

  if (dbMode === 'postgres') {
    await pgPool.query('DELETE FROM users WHERE id = $1', [id]);
    return true;
  }

  const local = readLocalDB();
  local.users = local.users.filter(u => u.id !== id);
  local.tasks = local.tasks.filter(t => t.internId !== id && t.intern_id !== id);
  local.submissions = local.submissions.filter(s => s.internId !== id && s.intern_id !== id);
  local.bugs = local.bugs.filter(b => b.internId !== id && b.intern_id !== id);
  local.daily_logs = local.daily_logs.filter(l => l.internId !== id && l.intern_id !== id);
  writeLocalDB(local);
  return true;
}

// ================= TASK OPERATIONS =================

async function getAllTasks() {
  if (dbMode === 'supabase') {
    const { data, error } = await supabaseClient.from('tasks').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(formatTaskForFrontend);
  }

  if (dbMode === 'postgres') {
    const res = await pgPool.query('SELECT * FROM tasks ORDER BY created_at DESC');
    return res.rows.map(formatTaskForFrontend);
  }

  const local = readLocalDB();
  return (local.tasks || []).map(formatTaskForFrontend);
}

async function getTasksByInternId(internId) {
  if (dbMode === 'supabase') {
    const { data, error } = await supabaseClient
      .from('tasks')
      .select('*')
      .eq('intern_id', internId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(formatTaskForFrontend);
  }

  if (dbMode === 'postgres') {
    const res = await pgPool.query('SELECT * FROM tasks WHERE intern_id = $1 ORDER BY created_at DESC', [internId]);
    return res.rows.map(formatTaskForFrontend);
  }

  const local = readLocalDB();
  return (local.tasks || []).filter(t => (t.internId === internId || t.intern_id === internId)).map(formatTaskForFrontend);
}

async function createTask(taskData) {
  const newTask = {
    id: taskData.id || ('tsk-' + Date.now()),
    intern_id: taskData.intern_id || taskData.internId,
    type: taskData.type || 'Task',
    title: taskData.title.trim(),
    description: taskData.description || '',
    priority: taskData.priority || 'Normal',
    status: taskData.status || 'To Do',
    due_date: taskData.due_date || taskData.dueDate || new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0],
    created_at: new Date().toISOString()
  };

  if (dbMode === 'supabase') {
    const { data, error } = await supabaseClient.from('tasks').insert(newTask).select().single();
    if (error) throw error;
    return formatTaskForFrontend(data);
  }

  if (dbMode === 'postgres') {
    const query = `
      INSERT INTO tasks (id, intern_id, type, title, description, priority, status, due_date, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *
    `;
    const res = await pgPool.query(query, Object.values(newTask));
    return formatTaskForFrontend(res.rows[0]);
  }

  const local = readLocalDB();
  local.tasks.unshift(newTask);
  writeLocalDB(local);
  return formatTaskForFrontend(newTask);
}

async function updateTask(id, updateData) {
  const dbUpdate = {};
  if (updateData.status) dbUpdate.status = updateData.status;
  if (updateData.title) dbUpdate.title = updateData.title;
  if (updateData.description !== undefined) dbUpdate.description = updateData.description;
  if (updateData.due_date || updateData.dueDate) dbUpdate.due_date = updateData.due_date || updateData.dueDate;
  if (updateData.priority) dbUpdate.priority = updateData.priority;

  if (dbMode === 'supabase') {
    const { data, error } = await supabaseClient
      .from('tasks')
      .update(dbUpdate)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return formatTaskForFrontend(data);
  }

  if (dbMode === 'postgres') {
    const keys = Object.keys(dbUpdate);
    const setClause = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
    const res = await pgPool.query(`UPDATE tasks SET ${setClause} WHERE id = $1 RETURNING *`, [id, ...Object.values(dbUpdate)]);
    return formatTaskForFrontend(res.rows[0]);
  }

  const local = readLocalDB();
  const idx = local.tasks.findIndex(t => t.id === id);
  if (idx !== -1) {
    local.tasks[idx] = { ...local.tasks[idx], ...dbUpdate };
    writeLocalDB(local);
    return formatTaskForFrontend(local.tasks[idx]);
  }
  return null;
}

async function deleteTask(id) {
  if (dbMode === 'supabase') {
    await supabaseClient.from('tasks').delete().eq('id', id);
    return true;
  }
  if (dbMode === 'postgres') {
    await pgPool.query('DELETE FROM tasks WHERE id = $1', [id]);
    return true;
  }
  const local = readLocalDB();
  local.tasks = local.tasks.filter(t => t.id !== id);
  writeLocalDB(local);
  return true;
}

function formatTaskForFrontend(t) {
  if (!t) return null;
  return {
    id: t.id,
    internId: t.intern_id || t.internId,
    type: t.type,
    title: t.title,
    description: t.description || '',
    priority: t.priority,
    status: t.status,
    dueDate: t.due_date || t.dueDate || '',
    createdAt: t.created_at || t.createdAt || ''
  };
}

// ================= SUBMISSIONS OPERATIONS =================

async function getAllSubmissions() {
  if (dbMode === 'supabase') {
    const { data, error } = await supabaseClient
      .from('submissions')
      .select('*, users(name, college, department)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(formatSubmissionForFrontend);
  }

  if (dbMode === 'postgres') {
    const query = `
      SELECT s.*, u.name as intern_name, u.college, u.department
      FROM submissions s
      LEFT JOIN users u ON s.intern_id = u.id
      ORDER BY s.created_at DESC
    `;
    const res = await pgPool.query(query);
    return res.rows.map(formatSubmissionForFrontend);
  }

  const local = readLocalDB();
  return (local.submissions || []).map(s => {
    const user = local.users.find(u => u.id === (s.intern_id || s.internId));
    return formatSubmissionForFrontend({
      ...s,
      intern_name: user?.name,
      college: user?.college,
      department: user?.department
    });
  });
}

async function getSubmissionsByInternId(internId) {
  if (dbMode === 'supabase') {
    const { data, error } = await supabaseClient
      .from('submissions')
      .select('*')
      .eq('intern_id', internId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(formatSubmissionForFrontend);
  }

  if (dbMode === 'postgres') {
    const res = await pgPool.query('SELECT * FROM submissions WHERE intern_id = $1 ORDER BY created_at DESC', [internId]);
    return res.rows.map(formatSubmissionForFrontend);
  }

  const local = readLocalDB();
  return (local.submissions || [])
    .filter(s => (s.intern_id === internId || s.internId === internId))
    .map(formatSubmissionForFrontend);
}

async function getSubmissionById(id) {
  if (dbMode === 'supabase') {
    const { data, error } = await supabaseClient
      .from('submissions')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    return data ? formatSubmissionForFrontend(data) : null;
  }

  if (dbMode === 'postgres') {
    const res = await pgPool.query('SELECT * FROM submissions WHERE id = $1', [id]);
    return res.rows[0] ? formatSubmissionForFrontend(res.rows[0]) : null;
  }

  const local = readLocalDB();
  const sub = local.submissions.find(s => s.id === id);
  return sub ? formatSubmissionForFrontend(sub) : null;
}

async function createSubmission(subData) {
  const newSub = {
    id: subData.id || ('sub-' + Date.now()),
    intern_id: subData.intern_id || subData.internId,
    task_id: subData.task_id || subData.taskId || null,
    work_title: subData.work_title || subData.workTitle,
    type: subData.type || 'Task',
    file_name: subData.file_name || subData.fileName,
    file_path: subData.file_path || subData.filePath,
    file_size: subData.file_size || subData.fileSize || '',
    submitted_at: subData.submitted_at || subData.submittedAt || new Date().toLocaleString(),
    status: subData.status || 'Under Review',
    notes: subData.notes || '',
    admin_comment: subData.admin_comment || '',
    created_at: new Date().toISOString()
  };

  if (dbMode === 'supabase') {
    const { data, error } = await supabaseClient.from('submissions').insert(newSub).select().single();
    if (error) throw error;
    return formatSubmissionForFrontend(data);
  }

  if (dbMode === 'postgres') {
    const query = `
      INSERT INTO submissions (id, intern_id, task_id, work_title, type, file_name, file_path, file_size, submitted_at, status, notes, admin_comment, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *
    `;
    const res = await pgPool.query(query, Object.values(newSub));
    return formatSubmissionForFrontend(res.rows[0]);
  }

  const local = readLocalDB();
  local.submissions.unshift(newSub);
  writeLocalDB(local);
  return formatSubmissionForFrontend(newSub);
}

async function updateSubmissionStatus(id, status, adminComment = '') {
  if (dbMode === 'supabase') {
    const { data, error } = await supabaseClient
      .from('submissions')
      .update({ status, admin_comment: adminComment })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return formatSubmissionForFrontend(data);
  }

  if (dbMode === 'postgres') {
    const res = await pgPool.query(
      'UPDATE submissions SET status = $1, admin_comment = $2 WHERE id = $3 RETURNING *',
      [status, adminComment, id]
    );
    return formatSubmissionForFrontend(res.rows[0]);
  }

  const local = readLocalDB();
  const idx = local.submissions.findIndex(s => s.id === id);
  if (idx !== -1) {
    local.submissions[idx].status = status;
    local.submissions[idx].admin_comment = adminComment;
    writeLocalDB(local);
    return formatSubmissionForFrontend(local.submissions[idx]);
  }
  return null;
}

function formatSubmissionForFrontend(s) {
  if (!s) return null;
  return {
    id: s.id,
    internId: s.intern_id || s.internId,
    taskId: s.task_id || s.taskId,
    workTitle: s.work_title || s.workTitle,
    type: s.type,
    fileName: s.file_name || s.fileName,
    filePath: s.file_path || s.filePath,
    fileSize: s.file_size || s.fileSize,
    submittedAt: s.submitted_at || s.submittedAt,
    status: s.status,
    notes: s.notes || '',
    adminComment: s.admin_comment || s.adminComment || '',
    internName: s.intern_name || s.users?.name,
    college: s.college || s.users?.college,
    department: s.department || s.users?.department
  };
}

// ================= BUGS OPERATIONS =================

async function getAllBugs() {
  if (dbMode === 'supabase') {
    const { data, error } = await supabaseClient
      .from('bugs')
      .select('*, users(name)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(formatBugForFrontend);
  }

  if (dbMode === 'postgres') {
    const res = await pgPool.query(`
      SELECT b.*, u.name as intern_name FROM bugs b
      LEFT JOIN users u ON b.intern_id = u.id
      ORDER BY b.created_at DESC
    `);
    return res.rows.map(formatBugForFrontend);
  }

  const local = readLocalDB();
  return (local.bugs || []).map(b => {
    const user = local.users.find(u => u.id === (b.intern_id || b.internId));
    return formatBugForFrontend({ ...b, intern_name: user?.name });
  });
}

async function getBugsByInternId(internId) {
  if (dbMode === 'supabase') {
    const { data, error } = await supabaseClient
      .from('bugs')
      .select('*')
      .eq('intern_id', internId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(formatBugForFrontend);
  }

  if (dbMode === 'postgres') {
    const res = await pgPool.query('SELECT * FROM bugs WHERE intern_id = $1 ORDER BY created_at DESC', [internId]);
    return res.rows.map(formatBugForFrontend);
  }

  const local = readLocalDB();
  return (local.bugs || []).filter(b => (b.intern_id === internId || b.internId === internId)).map(formatBugForFrontend);
}

async function getBugById(id) {
  if (dbMode === 'supabase') {
    const { data, error } = await supabaseClient.from('bugs').select('*').eq('id', id).maybeSingle();
    return data ? formatBugForFrontend(data) : null;
  }
  if (dbMode === 'postgres') {
    const res = await pgPool.query('SELECT * FROM bugs WHERE id = $1', [id]);
    return res.rows[0] ? formatBugForFrontend(res.rows[0]) : null;
  }
  const local = readLocalDB();
  const bug = local.bugs.find(b => b.id === id);
  return bug ? formatBugForFrontend(bug) : null;
}

async function createBug(bugData) {
  const newBug = {
    id: bugData.id || ('bug-' + Date.now()),
    intern_id: bugData.intern_id || bugData.internId,
    title: bugData.title.trim(),
    category: bugData.category || 'General',
    severity: bugData.severity || 'Major',
    status: bugData.status || 'Resolved',
    description: bugData.description || '',
    has_document: !!bugData.hasDocument || !!bugData.has_document,
    document_name: bugData.document_name || bugData.documentName || '',
    document_path: bugData.document_path || bugData.documentPath || '',
    document_size: bugData.document_size || bugData.documentSize || '',
    created_at: new Date().toISOString()
  };

  if (dbMode === 'supabase') {
    const { data, error } = await supabaseClient.from('bugs').insert(newBug).select().single();
    if (error) throw error;
    return formatBugForFrontend(data);
  }

  if (dbMode === 'postgres') {
    const query = `
      INSERT INTO bugs (id, intern_id, title, category, severity, status, description, has_document, document_name, document_path, document_size, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *
    `;
    const res = await pgPool.query(query, Object.values(newBug));
    return formatBugForFrontend(res.rows[0]);
  }

  const local = readLocalDB();
  local.bugs.unshift(newBug);
  writeLocalDB(local);
  return formatBugForFrontend(newBug);
}

async function updateBug(id, updateData) {
  if (dbMode === 'supabase') {
    const { data, error } = await supabaseClient
      .from('bugs')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return formatBugForFrontend(data);
  }

  if (dbMode === 'postgres') {
    const keys = Object.keys(updateData);
    const setClause = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
    const res = await pgPool.query(`UPDATE bugs SET ${setClause} WHERE id = $1 RETURNING *`, [id, ...Object.values(updateData)]);
    return formatBugForFrontend(res.rows[0]);
  }

  const local = readLocalDB();
  const idx = local.bugs.findIndex(b => b.id === id);
  if (idx !== -1) {
    local.bugs[idx] = { ...local.bugs[idx], ...updateData };
    writeLocalDB(local);
    return formatBugForFrontend(local.bugs[idx]);
  }
  return null;
}

async function deleteBug(id) {
  if (dbMode === 'supabase') {
    await supabaseClient.from('bugs').delete().eq('id', id);
    return true;
  }
  if (dbMode === 'postgres') {
    await pgPool.query('DELETE FROM bugs WHERE id = $1', [id]);
    return true;
  }
  const local = readLocalDB();
  local.bugs = local.bugs.filter(b => b.id !== id);
  writeLocalDB(local);
  return true;
}

function formatBugForFrontend(b) {
  if (!b) return null;
  return {
    id: b.id,
    internId: b.intern_id || b.internId,
    title: b.title,
    category: b.category,
    severity: b.severity,
    status: b.status,
    description: b.description || '',
    hasDocument: !!(b.has_document || b.hasDocument),
    documentName: b.document_name || b.documentName || '',
    documentPath: b.document_path || b.documentPath || '',
    documentSize: b.document_size || b.documentSize || '',
    internName: b.intern_name || b.users?.name || 'Intern',
    createdAt: b.created_at || b.createdAt || ''
  };
}

// ================= DAILY LOGS OPERATIONS =================

async function getAllLogs() {
  if (dbMode === 'supabase') {
    const { data, error } = await supabaseClient.from('daily_logs').select('*, users(name)').order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(formatLogForFrontend);
  }
  if (dbMode === 'postgres') {
    const res = await pgPool.query('SELECT l.*, u.name as intern_name FROM daily_logs l LEFT JOIN users u ON l.intern_id = u.id ORDER BY l.created_at DESC');
    return res.rows.map(formatLogForFrontend);
  }
  const local = readLocalDB();
  return (local.daily_logs || []).map(l => {
    const user = local.users.find(u => u.id === (l.intern_id || l.internId));
    return formatLogForFrontend({ ...l, intern_name: user?.name });
  });
}

async function getLogsByInternId(internId) {
  if (dbMode === 'supabase') {
    const { data, error } = await supabaseClient.from('daily_logs').select('*').eq('intern_id', internId).order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(formatLogForFrontend);
  }
  if (dbMode === 'postgres') {
    const res = await pgPool.query('SELECT * FROM daily_logs WHERE intern_id = $1 ORDER BY created_at DESC', [internId]);
    return res.rows.map(formatLogForFrontend);
  }
  const local = readLocalDB();
  return (local.daily_logs || []).filter(l => (l.intern_id === internId || l.internId === internId)).map(formatLogForFrontend);
}

async function createLog(logData) {
  const newLog = {
    id: logData.id || ('log-' + Date.now()),
    intern_id: logData.intern_id || logData.internId,
    date: logData.date || new Date().toISOString().split('T')[0],
    hours: Number(logData.hours) || 8,
    completed: logData.completed.trim(),
    next_plan: logData.next_plan || logData.nextPlan || '',
    blocker: logData.blocker || '',
    created_at: new Date().toISOString()
  };

  if (dbMode === 'supabase') {
    const { data, error } = await supabaseClient.from('daily_logs').insert(newLog).select().single();
    if (error) throw error;
    return formatLogForFrontend(data);
  }
  if (dbMode === 'postgres') {
    const query = `
      INSERT INTO daily_logs (id, intern_id, date, hours, completed, next_plan, blocker, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *
    `;
    const res = await pgPool.query(query, Object.values(newLog));
    return formatLogForFrontend(res.rows[0]);
  }
  const local = readLocalDB();
  local.daily_logs.unshift(newLog);
  writeLocalDB(local);
  return formatLogForFrontend(newLog);
}

function formatLogForFrontend(l) {
  if (!l) return null;
  return {
    id: l.id,
    internId: l.intern_id || l.internId,
    date: l.date,
    hours: l.hours,
    completed: l.completed,
    nextPlan: l.next_plan || l.nextPlan || '',
    blocker: l.blocker || '',
    internName: l.intern_name || l.users?.name,
    createdAt: l.created_at || l.createdAt
  };
}

// ================= SETTINGS OPERATIONS =================

async function getSettings() {
  if (dbMode === 'supabase') {
    const { data, error } = await supabaseClient.from('settings').select('*').eq('id', 'app_settings').maybeSingle();
    return data || { guide_name: 'Palani Pandi C', guide_org: 'Embedded & IoT Engineer working at Tarcin Robotics LLP', weekly_bug_quota: 10 };
  }
  if (dbMode === 'postgres') {
    const res = await pgPool.query("SELECT * FROM settings WHERE id = 'app_settings'");
    return res.rows[0] || { guide_name: 'Palani Pandi C', guide_org: 'Embedded & IoT Engineer working at Tarcin Robotics LLP', weekly_bug_quota: 10 };
  }
  const local = readLocalDB();
  return local.settings || { guide_name: 'Palani Pandi C', guide_org: 'Embedded & IoT Engineer working at Tarcin Robotics LLP', weekly_bug_quota: 10 };
}

async function updateSettings(data) {
  const update = {
    guide_name: data.guide_name || data.name,
    guide_org: data.guide_org || data.org,
    weekly_bug_quota: data.weekly_bug_quota || 10,
    updated_at: new Date().toISOString()
  };

  if (dbMode === 'supabase') {
    const { data: res, error } = await supabaseClient.from('settings').upsert({ id: 'app_settings', ...update }).select().single();
    if (error) throw error;
    return res;
  }
  if (dbMode === 'postgres') {
    const res = await pgPool.query(`
      INSERT INTO settings (id, guide_name, guide_org, weekly_bug_quota, updated_at)
      VALUES ('app_settings', $1, $2, $3, $4)
      ON CONFLICT (id) DO UPDATE SET guide_name = $1, guide_org = $2, weekly_bug_quota = $3, updated_at = $4
      RETURNING *
    `, [update.guide_name, update.guide_org, update.weekly_bug_quota, update.updated_at]);
    return res.rows[0];
  }
  const local = readLocalDB();
  local.settings = { id: 'app_settings', ...update };
  writeLocalDB(local);
  return local.settings;
}

// ================= FILE OPERATIONS (FILE DASHBOARD) =================
async function getAllFiles() {
  if (dbMode === 'supabase') {
    const { data, error } = await supabaseClient.from('files').select('*').order('created_at', { ascending: false });
    if (error) {
      console.warn('Supabase files fetch warning:', error.message);
      return (readLocalDB().files || []);
    }
    return data || [];
  }
  if (dbMode === 'postgres') {
    const res = await pgPool.query('SELECT * FROM files ORDER BY created_at DESC');
    return res.rows;
  }
  const local = readLocalDB();
  return local.files || [];
}

async function getFilesByInternId(internId) {
  if (dbMode === 'supabase') {
    const { data, error } = await supabaseClient
      .from('files')
      .select('*')
      .or(`intern_id.eq.${internId},intern_id.eq.all,intern_id.is.null`)
      .order('created_at', { ascending: false });
    if (error) {
      console.warn('Supabase files by intern fetch warning:', error.message);
      return (readLocalDB().files || []).filter(f => !f.intern_id || f.intern_id === 'all' || f.intern_id === internId);
    }
    return data || [];
  }
  if (dbMode === 'postgres') {
    const res = await pgPool.query(
      `SELECT * FROM files WHERE intern_id = $1 OR intern_id = 'all' OR intern_id IS NULL ORDER BY created_at DESC`,
      [internId]
    );
    return res.rows;
  }
  const local = readLocalDB();
  return (local.files || []).filter(f => !f.intern_id || f.intern_id === 'all' || f.intern_id === internId);
}

async function getFileById(id) {
  if (dbMode === 'supabase') {
    const { data } = await supabaseClient.from('files').select('*').eq('id', id).maybeSingle();
    if (data) return data;
  }
  if (dbMode === 'postgres') {
    const res = await pgPool.query('SELECT * FROM files WHERE id = $1', [id]);
    return res.rows[0] || null;
  }
  const local = readLocalDB();
  return (local.files || []).find(f => f.id === id) || null;
}

async function createFile(fileData) {
  const newFile = {
    id: fileData.id || ('file-' + Date.now()),
    file_name: fileData.file_name || fileData.fileName,
    storage_path: fileData.storage_path || fileData.storagePath || '',
    file_size: fileData.file_size || fileData.fileSize || '',
    description: fileData.description || '',
    task_id: fileData.task_id || fileData.taskId || null,
    task_title: fileData.task_title || fileData.taskTitle || '',
    intern_id: fileData.intern_id || fileData.internId || 'all',
    intern_name: fileData.intern_name || fileData.internName || 'All Interns',
    uploaded_by: fileData.uploaded_by || fileData.uploadedBy || 'Guide Palani Pandi C',
    uploaded_by_name: fileData.uploaded_by_name || fileData.uploadedByName || 'Guide Palani Pandi C',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  if (dbMode === 'supabase') {
    const { data, error } = await supabaseClient.from('files').insert(newFile).select().single();
    if (error) {
      console.warn('Supabase createFile warning, storing locally:', error.message);
    } else if (data) {
      return data;
    }
  }

  if (dbMode === 'postgres') {
    const res = await pgPool.query(`
      INSERT INTO files (id, file_name, storage_path, file_size, description, task_id, task_title, intern_id, intern_name, uploaded_by, uploaded_by_name, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `, [
      newFile.id, newFile.file_name, newFile.storage_path, newFile.file_size, newFile.description,
      newFile.task_id, newFile.task_title, newFile.intern_id, newFile.intern_name,
      newFile.uploaded_by, newFile.uploaded_by_name, newFile.created_at, newFile.updated_at
    ]);
    return res.rows[0];
  }

  const local = readLocalDB();
  if (!local.files) local.files = [];
  local.files.unshift(newFile);
  writeLocalDB(local);
  return newFile;
}

async function deleteFile(id) {
  if (dbMode === 'supabase') {
    await supabaseClient.from('files').delete().eq('id', id);
  }
  if (dbMode === 'postgres') {
    await pgPool.query('DELETE FROM files WHERE id = $1', [id]);
  }
  const local = readLocalDB();
  if (local.files) {
    local.files = local.files.filter(f => f.id !== id);
    writeLocalDB(local);
  }
  return true;
}

module.exports = {
  initDB,
  findUserByUsername,
  findUserById,
  getAllInterns,
  createUser,
  updateUser,
  deleteUser,
  getAllTasks,
  getTasksByInternId,
  createTask,
  updateTask,
  deleteTask,
  getAllSubmissions,
  getSubmissionsByInternId,
  getSubmissionById,
  createSubmission,
  updateSubmissionStatus,
  getAllFiles,
  getFilesByInternId,
  getFileById,
  createFile,
  deleteFile,
  getAllBugs,
  getBugsByInternId,
  getBugById,
  createBug,
  updateBug,
  deleteBug,
  getAllLogs,
  getLogsByInternId,
  createLog,
  getSettings,
  updateSettings,
  getDbMode: () => dbMode
};
