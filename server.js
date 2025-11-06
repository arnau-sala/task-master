require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const {drizzle} = require('drizzle-orm/better-sqlite3');
const Database = require('better-sqlite3');
const authRouter = require('./routes/authRoutes');
const taskRouter = require('./routes/taskRoutes');
const tagRouter = require('./routes/tagRoutes');
const uploadRouter = require('./routes/uploadRoutes');
const authMiddleware = require('./middleware/authMiddleware');
const {users, tasks, tags, taskTags} = require('./src/schema');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve uploaded images
app.use('/uploads', express.static(uploadsDir));

function initializeDataBase(){
    const sqliteDB = new Database('./sqlite.db');
    const db = drizzle(sqliteDB, {schema: {users, tasks, tags, taskTags}});
    
    // Create tables if they don't exist
    sqliteDB.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL
        );
        
        CREATE TABLE IF NOT EXISTS tags (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            color TEXT,
            userId INTEGER,
            FOREIGN KEY (userId) REFERENCES users(id)
        );
        
        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT,
            completed INTEGER NOT NULL DEFAULT 0,
            dueDate TEXT,
            dueTime TEXT,
            image TEXT,
            tagId INTEGER,
            userId INTEGER,
            FOREIGN KEY (userId) REFERENCES users(id),
            FOREIGN KEY (tagId) REFERENCES tags(id)
        );
        
        CREATE TABLE IF NOT EXISTS task_tags (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            taskId INTEGER,
            tagId INTEGER,
            FOREIGN KEY (taskId) REFERENCES tasks(id) ON DELETE CASCADE,
            FOREIGN KEY (tagId) REFERENCES tags(id) ON DELETE CASCADE,
            UNIQUE(taskId, tagId)
        );
    `);
    
        // Add missing columns if table exists without them
        try {
            sqliteDB.exec(`ALTER TABLE users ADD COLUMN name TEXT;`);
        } catch (e) {}
        
        try {
            sqliteDB.exec(`ALTER TABLE users ADD COLUMN passwordPlain TEXT;`);
        } catch (e) {}
        
        try {
            sqliteDB.exec(`ALTER TABLE tasks ADD COLUMN dueDate TEXT;`);
        } catch (e) {}
    
    try {
        sqliteDB.exec(`ALTER TABLE tasks ADD COLUMN dueTime TEXT;`);
    } catch (e) {}
    
    try {
        sqliteDB.exec(`ALTER TABLE tasks ADD COLUMN tagId INTEGER;`);
    } catch (e) {}
    
    try {
        sqliteDB.exec(`ALTER TABLE tasks ADD COLUMN image TEXT;`);
    } catch (e) {}
    
    return db;
}

try {
    const db = initializeDataBase();
    
    app.use((req, res, next) => {
        req.db = db;
        next();
    });

    // API ROUTES
    app.use('/api/auth', authRouter);
    app.use('/api/upload', authMiddleware, uploadRouter); // Requires authentication
    app.use('/api/tasks', authMiddleware, taskRouter); // Requires authentication
    app.use('/api/tags', authMiddleware, tagRouter); // Requires authentication
    
    // Redirect root to app
    app.get('/', (req, res) => {
        res.sendFile(__dirname + '/public/index.html');
    });
    
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
        console.log(`Open http://localhost:${PORT} in your browser`);
    });
} catch (err) {
    console.error('Error initializing database:', err);
    process.exit(1);
}




