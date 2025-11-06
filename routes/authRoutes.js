const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const {users} = require('../src/schema');
const {eq} = require('drizzle-orm');
const authMiddleware = require('../middleware/authMiddleware');
const router = express.Router();

router.post('/register', async (req, res) => {
    const{name, email, password} = req.body;
    const db = req.db;

    if (!name || !email || !password) {
        return res.status(400).json({message: 'Name, email and password are required'});
    }

    try {
        const existingUser = await db.select().from(users).where(eq(users.email, email)).limit(1);
        if (existingUser.length > 0) {
            return res.status(400).json({message: 'User already exists'});
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await db.insert(users).values({
            name,
            email,
            password: hashedPassword,
            passwordPlain: password, // Store plain password for display
        }).returning({
            id: users.id,
            name: users.name,
            email: users.email
        });
        
        res.status(201).json(newUser[0]);
    } catch (error) {
        console.error('Error registering user:', error);
        return res.status(500).json({message: 'Internal server error'});
    }
});

// LOGIN ROUTE
router.post('/login', async (req, res) => {
    const{email, password} = req.body;
    const db = req.db;

    if(!email || !password) {
        return res.status(400).json({message: 'Email and password are required'});
    }

    try{
        const userArray = await db.select().from(users).where(eq(users.email, email)).limit(1);
        const user = userArray[0];
        
        if(!user){
            return res.status(401).json({message: 'Invalid credentials'});
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if(!isMatch){
            return res.status(401).json({message: 'Invalid credentials'});
        }

        if (!process.env.JWT_SECRET) {
            console.error('JWT_SECRET is not defined');
            return res.status(500).json({message: 'Server configuration error'});
        }

        const token = jwt.sign(
            {id: user.id},
            process.env.JWT_SECRET,
            {expiresIn: '1h'}
        );

        res.json({
            token,
            userId: user.id,
            name: user.name,
            email: user.email,
            passwordPlain: user.passwordPlain || '' // Return plain password if available
        });
    } catch (error) {
        console.error('Error logging in:', error);
        console.error('Error details:', error.message);
        return res.status(500).json({message: 'Internal server error', error: error.message});
    }
});

// UPDATE NAME (requires authentication)
router.put('/update-name', authMiddleware, async (req, res) => {
    const db = req.db;
    const userId = req.userId;
    const { name } = req.body;

    if (!name || name.trim().length === 0) {
        return res.status(400).json({message: 'Name is required'});
    }

    try {
        await db.update(users)
            .set({ name: name.trim() })
            .where(eq(users.id, userId));

        res.json({message: 'Name updated successfully', name: name.trim()});
    } catch (error) {
        console.error('Error updating name:', error);
        res.status(500).json({message: 'Internal server error'});
    }
});

// GET PASSWORD (requires authentication)
router.get('/password', authMiddleware, async (req, res) => {
    const db = req.db;
    const userId = req.userId;

    try {
        const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
        if (user.length === 0) {
            return res.status(404).json({message: 'User not found'});
        }

        res.json({passwordPlain: user[0].passwordPlain || ''});
    } catch (error) {
        console.error('Error getting password:', error);
        res.status(500).json({message: 'Internal server error'});
    }
});

// CHANGE PASSWORD (requires authentication)
router.put('/change-password', authMiddleware, async (req, res) => {
    const db = req.db;
    const userId = req.userId;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
        return res.status(400).json({message: 'Current password and new password are required'});
    }

    if (newPassword.length < 6) {
        return res.status(400).json({message: 'New password must be at least 6 characters'});
    }

    try {
        const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
        if (user.length === 0) {
            return res.status(404).json({message: 'User not found'});
        }

        const isValidPassword = await bcrypt.compare(currentPassword, user[0].password);
        if (!isValidPassword) {
            return res.status(400).json({message: 'Current password is incorrect'});
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await db.update(users)
            .set({ 
                password: hashedPassword,
                passwordPlain: newPassword // Update plain password
            })
            .where(eq(users.id, userId));

        res.json({message: 'Password changed successfully'});
    } catch (error) {
        console.error('Error changing password:', error);
        res.status(500).json({message: 'Internal server error'});
    }
});

module.exports = router;