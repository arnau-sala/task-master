const express = require('express');
const {tasks, tags, taskTags} = require('../src/schema');
const {eq, inArray} = require('drizzle-orm');
const router = express.Router();

// GET ALL TASKS (requires authentication)
router.get('/', async (req, res) => {
    const db = req.db;
    const userId = req.userId;

    try {
        const userTasks = await db.select().from(tasks).where(eq(tasks.userId, userId));
        
        // Get all tags for each task from task_tags table
        const tasksWithTags = await Promise.all(userTasks.map(async (task) => {
            const taskTagRelations = await db.select().from(taskTags).where(eq(taskTags.taskId, task.id));
            
            if (taskTagRelations.length > 0) {
                const tagIds = taskTagRelations.map(rel => rel.tagId);
                const taskTagsList = await db.select().from(tags).where(inArray(tags.id, tagIds));
                return { ...task, tags: taskTagsList };
            }
            
            // Fallback to old tagId for backward compatibility
            if (task.tagId) {
                const tag = await db.select().from(tags).where(eq(tags.id, task.tagId)).limit(1);
                return { ...task, tags: tag.length > 0 ? [tag[0]] : [] };
            }
            
            return { ...task, tags: [] };
        }));
        
        res.json(tasksWithTags);
    } catch (error) {
        console.error('Error fetching tasks:', error);
        res.status(500).json({message: 'Internal server error'});
    }
});

// CREATE TASK (requires authentication)
router.post('/', async (req, res) => {
    const db = req.db;
    const userId = req.userId;
    const {title, description, dueDate, dueTime, tagIds, tagId, image} = req.body; // Support both tagIds (array) and tagId (single, backward compat)

    if (!title) {
        return res.status(400).json({message: 'Title is required'});
    }

    try {
        // Support both new array format and old single tagId
        const tagIdsArray = tagIds || (tagId ? [tagId] : []);
        
        // Verify all tags belong to user
        if (tagIdsArray.length > 0) {
            const userTags = await db.select().from(tags).where(inArray(tags.id, tagIdsArray));
            if (userTags.length !== tagIdsArray.length || userTags.some(tag => tag.userId !== userId)) {
                return res.status(400).json({message: 'Invalid tag(s)'});
            }
        }

        const newTask = await db.insert(tasks).values({
            title,
            description: description || '',
            completed: 0,
            dueDate: dueDate || null,
            dueTime: dueTime || null,
            image: image || null,
            tagId: tagIdsArray.length === 1 ? tagIdsArray[0] : null, // Keep for backward compatibility
            userId: userId
        }).returning();
        
        // Create task_tags relationships
        if (tagIdsArray.length > 0) {
            await Promise.all(tagIdsArray.map(tagId => 
                db.insert(taskTags).values({ taskId: newTask[0].id, tagId })
            ));
        }
        
        // Get all tags for response
        const taskTagRelations = await db.select().from(taskTags).where(eq(taskTags.taskId, newTask[0].id));
        if (taskTagRelations.length > 0) {
            const tagIdsFromRelations = taskTagRelations.map(rel => rel.tagId);
            const taskTagsList = await db.select().from(tags).where(inArray(tags.id, tagIdsFromRelations));
            newTask[0].tags = taskTagsList;
        } else {
            newTask[0].tags = [];
        }
        
        res.status(201).json(newTask[0]);
    } catch (error) {
        console.error('Error creating task:', error);
        res.status(500).json({message: 'Internal server error'});
    }
});

// UPDATE TASK (requires authentication)
router.put('/:id', async (req, res) => {
    const db = req.db;
    const userId = req.userId;
    const taskId = parseInt(req.params.id);
    const {title, description, completed, dueDate, dueTime, tagIds, tagId, image} = req.body;

    try {
        const task = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
        if (task.length === 0 || task[0].userId !== userId) {
            return res.status(404).json({message: 'Task not found'});
        }

        // Support both new array format and old single tagId
        const tagIdsArray = tagIds !== undefined ? tagIds : (tagId !== undefined && tagId !== null ? [tagId] : undefined);

        // Update task_tags if tagIds provided
        if (tagIdsArray !== undefined) {
            // Verify all tags belong to user
            if (tagIdsArray.length > 0) {
                const userTags = await db.select().from(tags).where(inArray(tags.id, tagIdsArray));
                if (userTags.length !== tagIdsArray.length || userTags.some(tag => tag.userId !== userId)) {
                    return res.status(400).json({message: 'Invalid tag(s)'});
                }
            }
            
            // Delete existing task_tags
            await db.delete(taskTags).where(eq(taskTags.taskId, taskId));
            
            // Insert new task_tags
            if (tagIdsArray.length > 0) {
                await Promise.all(tagIdsArray.map(tagId => 
                    db.insert(taskTags).values({ taskId, tagId })
                ));
            }
        }

        const updatedTask = await db.update(tasks)
            .set({
                title: title !== undefined ? title : task[0].title,
                description: description !== undefined ? description : task[0].description,
                completed: completed !== undefined ? completed : task[0].completed,
                dueDate: dueDate !== undefined ? dueDate : task[0].dueDate,
                dueTime: dueTime !== undefined ? dueTime : task[0].dueTime,
                image: image !== undefined ? image : task[0].image
            })
            .where(eq(tasks.id, taskId))
            .returning();
        
        // Get all tags for response
        const taskTagRelations = await db.select().from(taskTags).where(eq(taskTags.taskId, taskId));
        if (taskTagRelations.length > 0) {
            const tagIdsFromRelations = taskTagRelations.map(rel => rel.tagId);
            const taskTagsList = await db.select().from(tags).where(inArray(tags.id, tagIdsFromRelations));
            updatedTask[0].tags = taskTagsList;
        } else {
            updatedTask[0].tags = [];
        }
        
        res.json(updatedTask[0]);
    } catch (error) {
        console.error('Error updating task:', error);
        res.status(500).json({message: 'Internal server error'});
    }
});

// DELETE TASK (requires authentication)
router.delete('/:id', async (req, res) => {
    const db = req.db;
    const userId = req.userId;
    const taskId = parseInt(req.params.id);

    try {
        const task = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
        if (task.length === 0 || task[0].userId !== userId) {
            return res.status(404).json({message: 'Task not found'});
        }

        // Delete task_tags (CASCADE should handle this, but explicit for clarity)
        await db.delete(taskTags).where(eq(taskTags.taskId, taskId));
        
        // Delete task
        await db.delete(tasks).where(eq(tasks.id, taskId));
        res.json({message: 'Task deleted successfully'});
    } catch (error) {
        console.error('Error deleting task:', error);
        res.status(500).json({message: 'Internal server error'});
    }
});

module.exports = router;

