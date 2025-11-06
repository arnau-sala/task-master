// Script to clear all users and their tasks
// Run with: node clear-data.js

require('dotenv').config();
const Database = require('better-sqlite3');
const readline = require('readline');

const db = new Database('./sqlite.db');

// Get current data
const users = db.prepare('SELECT id, email FROM users').all();
const tasks = db.prepare('SELECT COUNT(*) as count FROM tasks').get();

console.log('\n' + '═'.repeat(80));
console.log(' ' + 'CLEAR DATABASE'.padEnd(78, ' ') + ' ');
console.log('═'.repeat(80) + '\n');

console.log('⚠️  WARNING: This will delete:');
console.log(`   - ${users.length} user(s)`);
console.log(`   - ${tasks.count} task(s)`);
console.log('\nUsers to be deleted:');
users.forEach(user => {
    console.log(`   - ${user.email} (ID: ${user.id})`);
});

console.log('\n' + '═'.repeat(80));

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

    rl.question('\nAre you sure you want to delete all users and tasks? (yes/no): ', (answer) => {
        if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
            try {
                // Delete in correct order to avoid foreign key constraint issues
                const taskTagsDeleted = db.prepare('DELETE FROM task_tags').run();
                const tasksDeleted = db.prepare('DELETE FROM tasks').run();
                const tagsDeleted = db.prepare('DELETE FROM tags').run();
                const usersDeleted = db.prepare('DELETE FROM users').run();
                
                console.log('\n✓ Successfully deleted:');
                console.log(`   - ${usersDeleted.changes} user(s)`);
                console.log(`   - ${tagsDeleted.changes} tag(s)`);
                console.log(`   - ${tasksDeleted.changes} task(s)`);
                console.log(`   - ${taskTagsDeleted.changes} task-tag relationship(s)`);
                console.log('\n✓ Database cleared!\n');
            } catch (error) {
                console.error('\n✗ Error deleting data:', error.message);
            }
        } else {
            console.log('\n✗ Operation cancelled.\n');
        }
        
        db.close();
        rl.close();
    });

