const express = require('express');
const {tags, tasks} = require('../src/schema');
const {eq} = require('drizzle-orm');
const router = express.Router();

// GET ALL TAGS (for current user)
router.get('/', async (req, res) => {
    const db = req.db;
    const userId = req.userId;

    try {
        const userTags = await db.select().from(tags).where(eq(tags.userId, userId));
        res.json(userTags);
    } catch (error) {
        console.error('Error fetching tags:', error);
        res.status(500).json({message: 'Internal server error'});
    }
});

// CREATE TAG
router.post('/', async (req, res) => {
    const db = req.db;
    const userId = req.userId;
    const {name, color, folderId} = req.body;

    if (!name) {
        return res.status(400).json({message: 'Tag name is required'});
    }

    if (name.length > 20) {
        return res.status(400).json({message: 'Tag name must be 20 characters or less'});
    }

    try {
        // Check if tag with same name already exists for this user
        const existingTag = await db.select().from(tags)
            .where(eq(tags.userId, userId))
            .where(eq(tags.name, name))
            .limit(1);
        
        if (existingTag.length > 0) {
            return res.status(400).json({message: 'Tag with this name already exists'});
        }

        // Verify folder belongs to user if folderId is provided
        if (folderId) {
            const {folders} = require('../src/schema');
            const folder = await db.select().from(folders)
                .where(eq(folders.id, folderId))
                .limit(1);
            
            if (folder.length === 0 || folder[0].userId !== userId) {
                return res.status(400).json({message: 'Invalid folder'});
            }
        }

        const newTag = await db.insert(tags).values({
            name,
            color: color || '#007bff',
            userId: userId,
            folderId: folderId || null
        }).returning();
        
        res.status(201).json(newTag[0]);
    } catch (error) {
        console.error('Error creating tag:', error);
        res.status(500).json({message: 'Internal server error'});
    }
});

// UPDATE TAG
router.put('/:id', async (req, res) => {
    const db = req.db;
    const userId = req.userId;
    const tagId = parseInt(req.params.id);
    const {name, color} = req.body;

    try {
        const tag = await db.select().from(tags).where(eq(tags.id, tagId)).limit(1);
        if (tag.length === 0 || tag[0].userId !== userId) {
            return res.status(404).json({message: 'Tag not found'});
        }

        const updatedTag = await db.update(tags)
            .set({
                name: name !== undefined ? name : tag[0].name,
                color: color !== undefined ? color : tag[0].color
            })
            .where(eq(tags.id, tagId))
            .returning();
        
        res.json(updatedTag[0]);
    } catch (error) {
        console.error('Error updating tag:', error);
        res.status(500).json({message: 'Internal server error'});
    }
});

// DELETE TAG
router.delete('/:id', async (req, res) => {
    const db = req.db;
    const userId = req.userId;
    const tagId = parseInt(req.params.id);

    try {
        const tag = await db.select().from(tags).where(eq(tags.id, tagId)).limit(1);
        if (tag.length === 0 || tag[0].userId !== userId) {
            return res.status(404).json({message: 'Tag not found'});
        }

        // Remove tag from all tasks that use it
        await db.update(tasks).set({tagId: null}).where(eq(tasks.tagId, tagId));

        await db.delete(tags).where(eq(tags.id, tagId));
        res.json({message: 'Tag deleted successfully'});
    } catch (error) {
        console.error('Error deleting tag:', error);
        res.status(500).json({message: 'Internal server error'});
    }
});

module.exports = router;

