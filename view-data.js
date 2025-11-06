// Database viewer with formatted output
// Run with: node view-data.js

require('dotenv').config();
const Database = require('better-sqlite3');

const db = new Database('./sqlite.db');

// Helper function to create table borders
function createLine(length) {
    return '─'.repeat(length);
}

// Helper function to pad strings
function pad(str, length, align = 'left') {
    str = String(str || '');
    if (align === 'left') {
        return str.padEnd(length, ' ');
    } else {
        return str.padStart(length, ' ');
    }
}

// Print Users Table
console.log('\n' + '═'.repeat(80));
console.log(' ' + 'USERS'.padEnd(78, ' ') + ' ');
console.log('═'.repeat(80) + '\n');

const users = db.prepare('SELECT id, email FROM users ORDER BY id').all();

if (users.length === 0) {
    console.log('  No users found\n');
} else {
    console.log('  ' + pad('ID', 6) + '│ ' + pad('Email', 70) + ' ');
    console.log('  ' + createLine(6) + '┼' + createLine(72));
    
    users.forEach(user => {
        console.log('  ' + pad(user.id, 6) + '│ ' + pad(user.email, 70));
    });
    console.log('  ' + createLine(79) + '\n');
}

// Print Tasks Table
console.log('═'.repeat(80));
console.log(' ' + 'TASKS'.padEnd(78, ' ') + ' ');
console.log('═'.repeat(80) + '\n');

const tasks = db.prepare(`
    SELECT t.id, t.title, t.description, t.completed, t.dueDate, t.dueTime, u.email as userEmail
    FROM tasks t
    LEFT JOIN users u ON t.userId = u.id
    ORDER BY t.id DESC
`).all();

if (tasks.length === 0) {
    console.log('  No tasks found\n');
} else {
    console.log('  ' + pad('ID', 6) + '│ ' + pad('Status', 12) + '│ ' + pad('Title', 25) + '│ ' + pad('User', 25) + '│ ' + pad('Due Date/Time', 15));
    console.log('  ' + createLine(6) + '┼' + createLine(12) + '┼' + createLine(25) + '┼' + createLine(25) + '┼' + createLine(15));
    
    tasks.forEach(task => {
        const status = task.completed ? '✓ Done' : '○ Pending';
        const title = (task.title || '').substring(0, 23) + (task.title && task.title.length > 23 ? '..' : '');
        const user = (task.userEmail || 'N/A').substring(0, 23);
        let dueInfo = '';
        if (task.dueDate && task.dueTime) {
            dueInfo = task.dueDate + ' ' + task.dueTime;
        } else if (task.dueDate) {
            dueInfo = task.dueDate;
        } else if (task.dueTime) {
            dueInfo = task.dueTime;
        } else {
            dueInfo = '-';
        }
        
        console.log('  ' + pad(task.id, 6) + '│ ' + pad(status, 12) + '│ ' + pad(title, 25) + '│ ' + pad(user, 25) + '│ ' + pad(dueInfo, 15));
        
        // Show description if exists
        if (task.description) {
            const desc = task.description.substring(0, 70);
            console.log('  ' + pad('', 6) + '│ ' + pad('', 12) + '│ ' + pad('  └─ ' + desc, 70));
        }
    });
    console.log('  ' + createLine(79) + '\n');
}

// Print Statistics
console.log('═'.repeat(80));
console.log(' ' + 'STATISTICS'.padEnd(78, ' ') + ' ');
console.log('═'.repeat(80) + '\n');

const stats = db.prepare(`
    SELECT 
        (SELECT COUNT(*) FROM users) as totalUsers,
        (SELECT COUNT(*) FROM tasks) as totalTasks,
        (SELECT COUNT(*) FROM tasks WHERE completed = 1) as completedTasks,
        (SELECT COUNT(*) FROM tasks WHERE completed = 0) as pendingTasks
`).get();

console.log('  ' + pad('Total Users:', 20) + pad(stats.totalUsers, 10, 'right'));
console.log('  ' + pad('Total Tasks:', 20) + pad(stats.totalTasks, 10, 'right'));
console.log('  ' + pad('Completed Tasks:', 20) + pad(stats.completedTasks, 10, 'right'));
console.log('  ' + pad('Pending Tasks:', 20) + pad(stats.pendingTasks, 10, 'right'));

if (stats.totalTasks > 0) {
    const completionRate = ((stats.completedTasks / stats.totalTasks) * 100).toFixed(1);
    console.log('  ' + pad('Completion Rate:', 20) + pad(completionRate + '%', 10, 'right'));
}

console.log('\n' + '═'.repeat(80) + '\n');

db.close();

