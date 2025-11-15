require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const {drizzle} = require('drizzle-orm/better-sqlite3');
const {eq} = require('drizzle-orm');
const Database = require('better-sqlite3');
const jwt = require('jsonwebtoken');
const authRouter = require('./routes/authRoutes');
const taskRouter = require('./routes/taskRoutes');
const tagRouter = require('./routes/tagRoutes');
const folderRouter = require('./routes/folderRoutes');
const uploadRouter = require('./routes/uploadRoutes');
const authMiddleware = require('./middleware/authMiddleware');
const {users, tasks, tags, taskTags, folders} = require('./src/schema');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Create uploads directory if it doesn't exist (outside public folder for security)
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

function initializeDataBase(){
    const sqliteDB = new Database('./sqlite.db');
    const db = drizzle(sqliteDB, {schema: {users, tasks, tags, taskTags, folders}});
    
    // Create tables if they don't exist
    sqliteDB.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL
        );
        
        CREATE TABLE IF NOT EXISTS folders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            color TEXT,
            userId INTEGER,
            FOREIGN KEY (userId) REFERENCES users(id)
        );
        
        CREATE TABLE IF NOT EXISTS tags (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            color TEXT,
            userId INTEGER,
            folderId INTEGER,
            FOREIGN KEY (userId) REFERENCES users(id),
            FOREIGN KEY (folderId) REFERENCES folders(id)
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
            sqliteDB.exec(`ALTER TABLE tags ADD COLUMN folderId INTEGER;`);
        } catch (e) {}
        
        try {
            sqliteDB.exec(`ALTER TABLE folders ADD COLUMN color TEXT;`);
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
    app.use('/api/folders', authMiddleware, folderRouter); // Requires authentication
    
    // Protected route to serve images (only to authenticated users who own the task)
    app.get('/api/uploads/:filename', async (req, res) => {
        const db = req.db;
        const filename = req.params.filename;
        
        // Support token from query parameter (for img tags) or Authorization header
        let token = req.query.token || req.headers.authorization?.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({message: 'No token provided'});
        }
        
        let userId;
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            userId = decoded.id;
        } catch (error) {
            return res.status(401).json({message: 'Invalid token'});
        }
        
        try {
            // Check if the image belongs to a task owned by the user
            const userTasks = await db.select().from(tasks).where(eq(tasks.userId, userId));
            // Check both new format (/api/uploads/) and old format (/uploads/) for backward compatibility
            const newImagePath = `/api/uploads/${filename}`;
            const oldImagePath = `/uploads/${filename}`;
            const taskWithImage = userTasks.find(task => 
                task.image === newImagePath || task.image === oldImagePath || 
                (task.image && task.image.includes(filename))
            );
            
            if (!taskWithImage) {
                return res.status(403).json({message: 'Access denied'});
            }
            
            // Serve the image file
            const filePath = path.join(uploadsDir, filename);
            if (!fs.existsSync(filePath)) {
                return res.status(404).json({message: 'Image not found'});
            }
            
            res.sendFile(filePath);
        } catch (error) {
            console.error('Error serving image:', error);
            res.status(500).json({message: 'Internal server error'});
        }
    });
    
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




