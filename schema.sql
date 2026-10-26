-- ====================================================================
-- Palani Interns Work flow - Tarcin Robotics LLP
-- Central Supabase / PostgreSQL Schema Definition
-- ====================================================================

-- 1. USERS TABLE (Admin & Interns)
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    role VARCHAR(20) NOT NULL DEFAULT 'INTERN', -- 'ADMIN' or 'INTERN'
    name VARCHAR(255) NOT NULL,
    username VARCHAR(100) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    domain VARCHAR(255) DEFAULT 'Embedded & IoT',
    status VARCHAR(50) DEFAULT 'Active', -- 'Active', 'In Review', 'On Leave'
    college VARCHAR(255) DEFAULT '',
    department VARCHAR(255) DEFAULT '',
    year VARCHAR(100) DEFAULT '3rd Year',
    email VARCHAR(255) DEFAULT '',
    phone VARCHAR(50) DEFAULT '',
    duration VARCHAR(100) DEFAULT '3 Months',
    guide VARCHAR(255) DEFAULT 'Palani Pandi C',
    joined_date VARCHAR(50) DEFAULT '',
    last_login_date VARCHAR(50) DEFAULT '',
    last_login_time VARCHAR(50) DEFAULT '',
    avatar_bg VARCHAR(50) DEFAULT 'avatar-gradient-1',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index on username for fast case-insensitive lookup
CREATE INDEX IF NOT EXISTS idx_users_username ON users (LOWER(username));
CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);

-- 2. TASKS & ASSESSMENTS TABLE
CREATE TABLE IF NOT EXISTS tasks (
    id VARCHAR(64) PRIMARY KEY,
    intern_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(30) NOT NULL DEFAULT 'Task', -- 'Task' or 'Assessment'
    title VARCHAR(255) NOT NULL,
    description TEXT DEFAULT '',
    priority VARCHAR(30) DEFAULT 'Normal', -- 'Normal', 'High', 'Low'
    status VARCHAR(50) DEFAULT 'To Do', -- 'To Do', 'In Progress', 'Task Completed', 'Assessment Completed', 'Completed'
    due_date VARCHAR(50) DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_intern_id ON tasks (intern_id);
CREATE INDEX IF NOT EXISTS idx_tasks_type ON tasks (type);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks (status);

-- 3. SUBMISSIONS TABLE (.ZIP Deliverables)
CREATE TABLE IF NOT EXISTS submissions (
    id VARCHAR(64) PRIMARY KEY,
    intern_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    task_id VARCHAR(64) REFERENCES tasks(id) ON DELETE SET NULL,
    work_title VARCHAR(255) NOT NULL,
    type VARCHAR(30) NOT NULL DEFAULT 'Task', -- 'Task' or 'Assessment'
    file_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size VARCHAR(50) DEFAULT '',
    submitted_at VARCHAR(100) NOT NULL,
    status VARCHAR(50) DEFAULT 'Under Review', -- 'Under Review', 'Approved', 'Rejected'
    notes TEXT DEFAULT '',
    admin_comment TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_submissions_intern_id ON submissions (intern_id);
CREATE INDEX IF NOT EXISTS idx_submissions_type ON submissions (type);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions (status);

-- 4. BUGS TRACKER TABLE (Weekly 10 Bugs Quota)
CREATE TABLE IF NOT EXISTS bugs (
    id VARCHAR(64) PRIMARY KEY,
    intern_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(100) DEFAULT 'General',
    severity VARCHAR(50) DEFAULT 'Major', -- 'Minor', 'Major', 'Critical'
    status VARCHAR(50) DEFAULT 'Resolved', -- 'Open', 'Resolved'
    description TEXT DEFAULT '',
    has_document BOOLEAN DEFAULT FALSE,
    document_name VARCHAR(255) DEFAULT '',
    document_path TEXT DEFAULT '',
    document_size VARCHAR(50) DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bugs_intern_id ON bugs (intern_id);
CREATE INDEX IF NOT EXISTS idx_bugs_status ON bugs (status);

-- 5. DAILY LOGS TABLE (Standups)
CREATE TABLE IF NOT EXISTS daily_logs (
    id VARCHAR(64) PRIMARY KEY,
    intern_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date VARCHAR(50) NOT NULL,
    hours NUMERIC DEFAULT 8,
    completed TEXT NOT NULL,
    next_plan TEXT DEFAULT '',
    blocker TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_logs_intern_id ON daily_logs (intern_id);
CREATE INDEX IF NOT EXISTS idx_logs_date ON daily_logs (date);

-- 6. SYSTEM SETTINGS
CREATE TABLE IF NOT EXISTS settings (
    id VARCHAR(64) PRIMARY KEY,
    guide_name VARCHAR(255) DEFAULT 'Palani Pandi C',
    guide_org VARCHAR(255) DEFAULT 'Embedded & IoT Engineer working at Tarcin Robotics LLP',
    weekly_bug_quota INTEGER DEFAULT 10,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed initial settings
INSERT INTO settings (id, guide_name, guide_org, weekly_bug_quota)
VALUES ('app_settings', 'Palani Pandi C', 'Embedded & IoT Engineer working at Tarcin Robotics LLP', 10)
ON CONFLICT (id) DO NOTHING;

-- Initial default Admin account: palani / 29052005
-- Password hash for '29052005' generated programmatically on backend startup
