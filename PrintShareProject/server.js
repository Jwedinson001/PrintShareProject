const express = require('express');
const multer = require('multer');
const path = require('path');
const mysql = require('mysql2');
const crypto = require('crypto');
const fs = require('fs');

const app = express();
const PORT = 80;

// Database setup
const db = mysql.createConnection({
    host: '34.139.226.160',
    user: 'NodeUser',
    password: '',
    database: 'PrintShare',
});

db.connect(err => {
    if (err) {
        console.error('Database connection failed:', err.message);
    } else {
        console.log('Connected to the database.');
    }
});

// Middleware
app.use(express.json()); // To parse JSON bodies
app.use(express.urlencoded({ extended: true })); // To parse form-urlencoded bodies

// Configure multer for image uploads
const upload = multer({
    dest: 'uploads/', // Directory to save files
    limits: { fileSize: 5 * 1024 * 1024 }, // Limit file size to 5MB
    fileFilter: (req, file, cb) => {
        // Only accept image files
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('Only image files are allowed!'));
        }
        cb(null, true);
    },
});

// Serve static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'public_html')));

// User signup
app.post('/signup', upload.single('profilePicture'), (req, res) => {
    const { username, email, password } = req.body;
    const profilePicture = req.file ? `/uploads/${req.file.filename}` : null;

    if (!username || !email || !password) {
        return res.status(400).json({ success: false, message: 'Missing required fields.' });
    }

    const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
    db.query(
        'INSERT INTO users (username, email, password_hash, profile_picture_url) VALUES (?, ?, ?, ?)',
        [username, email, hashedPassword, profilePicture],
        (err) => {
            if (err) {
                console.error('Error saving user to database:', err);
                return res.status(500).json({ success: false, message: 'Error creating account.' });
            }
            res.status(201).json({ success: true, message: 'Account created successfully.' });
        }
    );
});

// User login
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Missing username or password.' });
    }

    db.query('SELECT * FROM users WHERE username = ?', [username], (err, results) => {
        if (err || results.length === 0) {
            return res.status(401).json({ success: false, message: 'Invalid credentials.' });
        }

        const user = results[0];
        const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');

        if (hashedPassword === user.password_hash) {
            res.status(200).json({
                success: true,
                userId: user.id,
                username: user.username,
                email: user.email,
                profilePictureUrl: user.profile_picture_url,
            });
        } else {
            res.status(401).json({ success: false, message: 'Invalid credentials.' });
        }
    });
});

// Update Profile
app.post('/update-profile', upload.single('profilePicture'), (req, res) => {
    const { userId, email, password } = req.body;
    const profilePicture = req.file ? `/uploads/${req.file.filename}` : null;

    if (!userId) {
        return res.status(400).json({ success: false, message: 'Missing userId parameter' });
    }

    // Get current profile picture URL from the database
    db.query('SELECT profile_picture_url FROM users WHERE id = ?', [userId], (err, results) => {
        if (err) {
            console.error('Error fetching user profile:', err);
            return res.status(500).json({ success: false, message: 'Error fetching user profile' });
        }

        if (results.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const currentProfilePicture = results[0].profile_picture_url;

        // If a new profile picture is provided, delete the old one
        if (profilePicture && currentProfilePicture) {
            const oldProfilePicturePath = path.join(__dirname, currentProfilePicture);
            fs.unlink(oldProfilePicturePath, (unlinkErr) => {
                if (unlinkErr) {
                    console.error('Error deleting old profile picture:', unlinkErr);
                } else {
                    console.log('Old profile picture deleted:', oldProfilePicturePath);
                }
            });
        }

        // Prepare updates for the user
        const updates = [];
        const values = [];

        if (email) {
            updates.push('email = ?');
            values.push(email);
        }
        if (password) {
            const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
            updates.push('password_hash = ?');
            values.push(hashedPassword);
        }
        if (profilePicture) {
            updates.push('profile_picture_url = ?');
            values.push(profilePicture);
        }

        if (updates.length === 0) {
            return res.status(400).json({ success: false, message: 'No fields provided to update' });
        }

        values.push(userId);

        // Update the user record
        const query = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
        db.query(query, values, (updateErr) => {
            if (updateErr) {
                console.error('Error updating user profile:', updateErr);
                return res.status(500).json({ success: false, message: 'Error updating profile' });
            }

            res.status(200).json({ success: true, message: 'Profile updated successfully' });
        });
    });
});

// Get the user
app.get('/users', (req, res) => {
    const userId = req.query.userId;

    if (!userId) {
        return res.status(400).json({ success: false, message: 'Missing userId parameter' });
    }

    db.query('SELECT * FROM users WHERE id = ?', [userId], (err, results) => {
        if (err) {
            console.error('Error fetching user:', err);
            return res.status(500).json({ success: false, message: 'Error fetching user' });
        }

        if (results.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const user = results[0];
        res.status(200).json({
            success: true,
            email: user.email,
            profile_picture_url: user.profile_picture_url,
        });
    });
});

// Create post
app.post('/create-post', upload.single('image'), (req, res) => {
    const { title, content, userId } = req.body;
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

    if (!title || !content || !userId) {
        return res.status(400).json({ success: false, message: 'Missing required fields.' });
    }

    db.query(
        'INSERT INTO posts (user_id, title, content, image_url, created_at) VALUES (?, ?, ?, ?, NOW())',
        [userId, title, content, imageUrl],
        (err) => {
            if (err) {
                console.error('Error saving post to database:', err);
                return res.status(500).json({ success: false, message: 'Error creating post.' });
            }
            res.status(201).json({ success: true, message: 'Post created successfully.' });
        }
    );
});

// Fetch posts
app.get('/get-posts', (req, res) => {
    const userId = req.query.userId;
    let query = 'SELECT * FROM posts';
    const params = [];

    if (userId) {
        query += ' WHERE user_id = ?';
        params.push(userId);
    }

    query += ' ORDER BY created_at DESC';

    db.query(query, params, (err, results) => {
        if (err) {
            console.error('Error fetching posts:', err);
            return res.status(500).json({ success: false, message: 'Error fetching posts.' });
        }
        res.status(200).json({ success: true, posts: results });
    });
});

// Fetch post details
app.get('/get-post-details', (req, res) => {
    const postId = req.query.postId;
    if (!postId) {
        return res.status(400).json({ success: false, message: 'Missing postId parameter.' });
    }

    db.query('SELECT * FROM posts WHERE id = ?', [postId], (err, results) => {
        if (err) {
            console.error('Error fetching post details:', err);
            return res.status(500).json({ success: false, message: 'Error fetching post details.' });
        }

        if (results.length === 0) {
            return res.status(404).json({ success: false, message: 'Post not found.' });
        }

        const post = results[0];
        res.status(200).json({ success: true, post });
    });
});

// Fetch comments for a post
app.get('/get-comments', (req, res) => {
    const postId = req.query.postId;
    if (!postId) {
        return res.status(400).json({ success: false, message: 'Missing postId parameter.' });
    }

    db.query('SELECT * FROM comments WHERE post_id = ? ORDER BY created_at ASC', [postId], (err, results) => {
        if (err) {
            console.error('Error fetching comments:', err);
            return res.status(500).json({ success: false, message: 'Error fetching comments.' });
        }

        res.status(200).json({ success: true, comments: results });
    });
});

// Add a comment to a post
app.post('/add-comment', (req, res) => {
    const { postId, userId, content } = req.body;

    if (!postId || !userId || !content) {
        return res.status(400).json({ success: false, message: 'Missing required fields.' });
    }

    db.query(
        'INSERT INTO comments (post_id, user_id, content, created_at) VALUES (?, ?, ?, NOW())',
        [postId, userId, content],
        (err) => {
            if (err) {
                console.error('Error saving comment to database:', err);
                return res.status(500).json({ success: false, message: 'Error adding comment.' });
            }

            res.status(201).json({ success: true, message: 'Comment added successfully.' });
        }
    );
});

// Add a message to the chat
app.post('/messages', (req, res) => {
    const { senderId, content, receiverId = 0 } = req.body; // Default receiverId to 0 if not provided

    if (!senderId || !content) {
        return res.status(400).json({ success: false, message: 'Missing required fields.' });
    }

    db.query(
        'INSERT INTO messages (sender_id, receiver_id, content, created_at) VALUES (?, ?, ?, NOW())',
        [senderId, receiverId, content],
        (err) => {
            if (err) {
                console.error('Error saving message to database:', err);
                return res.status(500).json({ success: false, message: 'Error sending message.' });
            }

            res.status(201).json({ success: true, message: 'Message sent successfully.' });
        }
    );
});

// Fetch chat messages
app.get('/messages', (req, res) => {
    const query = `
        SELECT messages.*, users.username AS sender_username
        FROM messages
        JOIN users ON messages.sender_id = users.id
        ORDER BY messages.created_at ASC
    `;
    db.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching messages:', err);
            return res.status(500).json({ success: false, message: 'Error fetching messages.' });
        }
        res.status(200).json({ success: true, messages: results });
    });
});

// Delete post
app.delete('/posts', (req, res) => {
    const postId = req.query.postId;

    if (!postId) {
        return res.status(400).json({ success: false, message: 'Missing post ID.' });
    }

    db.query('DELETE FROM posts WHERE id = ?', [postId], (err) => {
        if (err) {
            console.error('Error deleting post:', err);
            return res.status(500).json({ success: false, message: 'Error deleting post.' });
        }
        res.status(200).json({ success: true, message: 'Post deleted successfully.' });
    });
});

// Serve fallback for unmatched routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public_html', 'index.html'));
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}/`);
});