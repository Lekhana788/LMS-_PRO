const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const axios = require('axios');
const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 10000;

// Database connection - handle both local and production environments
const dbPath = process.env.NODE_ENV === 'production' 
    ? '/opt/render/project/src/lms.db' 
    : path.join(__dirname, 'lms.db');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to SQLite database at:', dbPath);
    }
});

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Session configuration
app.use(session({
    secret: 'your-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// YouTube video validation function
async function validateYouTubeVideo(videoId) {
    try {
        const response = await axios.get(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
        return response.status === 200;
    } catch (error) {
        return false;
    }
}

// Middleware to check if user is authenticated
function isAuthenticated(req, res, next) {
    if (req.session.user) {
        next();
    } else {
        res.redirect('/login');
    }
}

// Routes
app.get('/', (req, res) => {
    if (req.session.user) {
        res.redirect('/dashboard');
    } else {
        res.redirect('/register');
    }
});

app.get('/register', (req, res) => {
    res.render('register', { error: null });
});

app.post('/register', async (req, res) => {
    const { username, email, password, confirmPassword } = req.body;
    
    if (password !== confirmPassword) {
        return res.render('register', { error: 'Passwords do not match' });
    }
    
    // Check if user exists
    db.get("SELECT email FROM users WHERE email = ?", [email], (err, row) => {
        if (err) {
            return res.render('register', { error: 'Database error' });
        }
        
        if (row) {
            return res.render('register', { error: 'Email already exists' });
        }
        
        // Create user
        bcrypt.hash(password, 10, (err, hash) => {
            if (err) {
                return res.render('register', { error: 'Error creating user' });
            }
            
            db.run("INSERT INTO users (username, email, password) VALUES (?, ?, ?)",
                [username, email, hash], (err) => {
                if (err) {
                    return res.render('register', { error: 'Error creating user' });
                }
                res.redirect('/login');
            });
        });
    });
});

app.get('/login', (req, res) => {
    res.render('login', { error: null });
});

app.post('/login', (req, res) => {
    const { email, password } = req.body;
    
    db.get("SELECT * FROM users WHERE email = ?", [email], (err, user) => {
        if (err) {
            return res.render('login', { error: 'Database error' });
        }
        
        if (!user) {
            return res.render('login', { error: 'Invalid email or password' });
        }
        
        bcrypt.compare(password, user.password, (err, isValid) => {
            if (err || !isValid) {
                return res.render('login', { error: 'Invalid email or password' });
            }
            
            req.session.user = user;
            res.redirect('/dashboard');
        });
    });
});

app.get('/dashboard', isAuthenticated, (req, res) => {
    db.all("SELECT * FROM subjects ORDER BY title", (err, courses) => {
        if (err) {
            return res.status(500).send('Error loading courses');
        }
        
        // Get video counts for each course
        const coursesWithCounts = courses.map(course => {
            return new Promise((resolve) => {
                db.get("SELECT COUNT(*) as count FROM videos WHERE subject_id = ?", [course.id], (err, row) => {
                    resolve({
                        ...course,
                        videoCount: row ? row.count : 0
                    });
                });
            });
        });
        
        Promise.all(coursesWithCounts).then(coursesData => {
            res.render('dashboard', { courses: coursesData, user: req.session.user });
        });
    });
});

app.get('/course/:courseId', isAuthenticated, async (req, res) => {
    const courseId = req.params.courseId;
    
    db.get("SELECT * FROM subjects WHERE course_key = ?", [courseId], (err, course) => {
        if (err || !course) {
            return res.status(404).send('Course not found');
        }
        
        db.all("SELECT * FROM videos WHERE subject_id = ? ORDER BY order_index", [course.id], async (err, videos) => {
            if (err) {
                return res.status(500).send('Error loading videos');
            }
            
            // Validate YouTube videos
            const validatedVideos = [];
            for (const video of videos) {
                const isValid = await validateYouTubeVideo(video.youtube_video_id);
                validatedVideos.push({
                    ...video,
                    videoValid: isValid
                });
            }
            
            res.render('course', { 
                course, 
                courseId, 
                sections: validatedVideos, 
                user: req.session.user 
            });
        });
    });
});

app.get('/course/:courseId/section/:sectionId', isAuthenticated, async (req, res) => {
    const courseId = req.params.courseId;
    const sectionId = parseInt(req.params.sectionId);
    
    db.get("SELECT * FROM subjects WHERE course_key = ?", [courseId], (err, course) => {
        if (err || !course) {
            return res.status(404).send('Course not found');
        }
        
        db.get("SELECT * FROM videos WHERE subject_id = ? AND id = ?", [course.id, sectionId], async (err, video) => {
            if (err || !video) {
                return res.status(404).send('Section not found');
            }
            
            // Validate YouTube video
            const videoValid = await validateYouTubeVideo(video.youtube_video_id);
            
            res.render('video', { 
                course, 
                courseId, 
                section: video, 
                videoValid,
                user: req.session.user 
            });
        });
    });
});

app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.redirect('/dashboard');
        }
        res.redirect('/login');
    });
});

// Wait for database initialization before starting server
const startServer = () => {
    app.listen(PORT, () => {
        console.log(`LMS Server running on http://localhost:${PORT}`);
    });
};

// Check if database is ready before starting server
const checkDatabaseReady = () => {
    return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
            db.get("SELECT COUNT(*) as count FROM subjects", (err, row) => {
                if (!err && row && row.count > 0) {
                    console.log('Database is ready - starting server');
                    clearInterval(checkInterval);
                    resolve();
                }
            });
        }, 1000);
    });
};

// Initialize database and start server
const initializeDatabase = () => {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT, email TEXT, password TEXT)");
            db.run("CREATE TABLE IF NOT EXISTS subjects (id INTEGER PRIMARY KEY AUTOINCREMENT, course_key TEXT, title TEXT)");
            db.run("CREATE TABLE IF NOT EXISTS videos (id INTEGER PRIMARY KEY AUTOINCREMENT, subject_id INTEGER, youtube_video_id TEXT, order_index INTEGER)");
            resolve();
        }, (err) => {
            reject(err);
        });
    });
};

initializeDatabase().then(() => {
    console.log('Database initialization completed - starting server');
    checkDatabaseReady().then(() => {
        startServer();
    });
}).catch(err => {
    console.error('Database initialization failed:', err);
    process.exit(1);
});
