const {sqliteTable, text, integer} = require('drizzle-orm/sqlite-core');

// USERS TABLE
const users = sqliteTable('users', {
    id: integer('id').primaryKey({autoIncrement: true}),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    password: text('password').notNull(),
    passwordPlain: text('passwordPlain'), // Store plain password for display purposes
});

// FOLDERS TABLE
const folders = sqliteTable('folders', {
    id: integer('id').primaryKey({autoIncrement: true}),
    name: text('name').notNull(),
    color: text('color'),
    pinned: integer('pinned').default(0),
    userId: integer('userId').references(() => users.id),
});

// TAGS TABLE
const tags = sqliteTable('tags', {
    id: integer('id').primaryKey({autoIncrement: true}),
    name: text('name').notNull(),
    color: text('color'),
    pinned: integer('pinned').default(0),
    userId: integer('userId').references(() => users.id),
    folderId: integer('folderId').references(() => folders.id),
});

// TASKS TABLE
const tasks = sqliteTable('tasks', {
    id: integer('id').primaryKey({autoIncrement: true}),
    title: text('title').notNull(),
    description: text('description'),
    completed: integer('completed').notNull().default(0),
    dueDate: text('dueDate'),
    dueTime: text('dueTime'),
    image: text('image'),
    tagId: integer('tagId').references(() => tags.id), // Keep for backward compatibility
    userId: integer('userId').references(() => users.id),
});

// TASK_TAGS TABLE (many-to-many relationship)
const taskTags = sqliteTable('task_tags', {
    id: integer('id').primaryKey({autoIncrement: true}),
    taskId: integer('taskId').references(() => tasks.id),
    tagId: integer('tagId').references(() => tags.id),
});

module.exports = {users, tasks, tags, taskTags, folders};

