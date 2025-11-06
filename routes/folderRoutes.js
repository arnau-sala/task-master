const express = require('express');
const {folders, tags} = require('../src/schema');
const {eq} = require('drizzle-orm');
const router = express.Router();

// GET ALL FOLDERS (for current user)
router.get('/', async (req, res) => {
    const db = req.db;
    const userId = req.userId;

    try {
        const userFolders = await db.select().from(folders).where(eq(folders.userId, userId));
        res.json(userFolders);
    } catch (error) {
        console.error('Error fetching folders:', error);
        res.status(500).json({message: 'Internal server error'});
    }
});

// CREATE FOLDER
router.post('/', async (req, res) => {
    const db = req.db;
    const userId = req.userId;
    const {name, color} = req.body;

    if (!name) {
        return res.status(400).json({message: 'Folder name is required'});
    }

    try {
        // Check if folder with same name already exists for this user
        const existingFolder = await db.select().from(folders)
            .where(eq(folders.userId, userId))
            .where(eq(folders.name, name))
            .limit(1);
        
        if (existingFolder.length > 0) {
            return res.status(400).json({message: 'Folder with this name already exists'});
        }

        const newFolder = await db.insert(folders).values({
            name,
            color: color || '#64748b',
            userId: userId
        }).returning();
        
        res.status(201).json(newFolder[0]);
    } catch (error) {
        console.error('Error creating folder:', error);
        res.status(500).json({message: 'Internal server error'});
    }
});

// UPDATE FOLDER
router.put('/:id', async (req, res) => {
    const db = req.db;
    const userId = req.userId;
    const folderId = parseInt(req.params.id);
    const {name, color} = req.body;

    if (!name) {
        return res.status(400).json({message: 'Folder name is required'});
    }

    try {
        // Verify folder belongs to user
        const folder = await db.select().from(folders)
            .where(eq(folders.id, folderId))
            .limit(1);
        
        if (folder.length === 0 || folder[0].userId !== userId) {
            return res.status(404).json({message: 'Folder not found'});
        }

        // Check if another folder with same name exists
        const existingFolder = await db.select().from(folders)
            .where(eq(folders.userId, userId))
            .where(eq(folders.name, name))
            .limit(1);
        
        if (existingFolder.length > 0 && existingFolder[0].id !== folderId) {
            return res.status(400).json({message: 'Folder with this name already exists'});
        }

        const updatedFolder = await db.update(folders)
            .set({
                name,
                color: color !== undefined ? color : folder[0].color
            })
            .where(eq(folders.id, folderId))
            .returning();
        
        res.json(updatedFolder[0]);
    } catch (error) {
        console.error('Error updating folder:', error);
        res.status(500).json({message: 'Internal server error'});
    }
});

// DELETE FOLDER
router.delete('/:id', async (req, res) => {
    const db = req.db;
    const userId = req.userId;
    const folderId = parseInt(req.params.id);

    try {
        // Verify folder belongs to user
        const folder = await db.select().from(folders)
            .where(eq(folders.id, folderId))
            .limit(1);
        
        if (folder.length === 0 || folder[0].userId !== userId) {
            return res.status(404).json({message: 'Folder not found'});
        }

        // Remove folderId from all tags in this folder (set to null)
        await db.update(tags)
            .set({folderId: null})
            .where(eq(tags.folderId, folderId));

        // Delete folder
        await db.delete(folders).where(eq(folders.id, folderId));
        
        res.json({message: 'Folder deleted'});
    } catch (error) {
        console.error('Error deleting folder:', error);
        res.status(500).json({message: 'Internal server error'});
    }
});

module.exports = router;

