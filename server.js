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
        initializeDatabase();
    }
});

// Initialize database with default data
function initializeDatabase() {
    return new Promise((resolve) => {
        // Check if subjects exist
        db.get("SELECT COUNT(*) as count FROM subjects", (err, row) => {
            if (err || row.count === 0) {
                console.log('Initializing database with default data...');
                // Insert default subjects and videos
                const courses = [
                    {
                        key: 'java',
                        title: 'Java Programming',
                        description: 'Complete Java course from basics to advanced',
                        icon: '☕',
                        videos: [
                            { title: 'Introduction to Java', videoId: 'Sf9uu8hnOdY', order: 1 },
                            { title: 'Variables and Data Types', videoId: 'Bk4y_78S5Q0', order: 2 },
                            { title: 'Control Statements', videoId: 'aXgItI-6_7E', order: 3 },
                            { title: 'Methods and Functions', videoId: 'gQh9DF2fKqQ', order: 4 },
                            { title: 'Object-Oriented Programming', videoId: '9Bgmc9LKBBg', order: 5 },
                            { title: 'Inheritance and Polymorphism', videoId: 'WDzY4JQm9gE', order: 6 },
                            { title: 'Exception Handling', videoId: 'Bk4y_78S5Q0', order: 7 },
                            { title: 'Collections Framework', videoId: '1Q3yX7_2FG8', order: 8 },
                            { title: 'File I/O Operations', videoId: '93s3wxE4B8A', order: 9 },
                            { title: 'Multithreading', videoId: 'V1rQk5hX0qM', order: 10 },
                            { title: 'Java 8 Features', videoId: '1eA1C3u0J4w', order: 11 },
                            { title: 'Spring Boot Basics', videoId: '9SGDpanrc8U', order: 12 }
                        ]
                    },
                    {
                        key: 'python',
                        title: 'Python Programming',
                        description: 'Learn Python from scratch to advanced concepts',
                        icon: '🐍',
                        videos: [
                            { title: 'Python Introduction', videoId: 'rfscVS0vtbw', order: 1 },
                            { title: 'Variables and Data Types', videoId: 'k9TUPpGqY4g', order: 2 },
                            { title: 'Control Flow', videoId: '6iF8Xb7Z3wQ', order: 3 },
                            { title: 'Functions', videoId: 'nsLqTmNvS3g', order: 4 },
                            { title: 'Lists and Tuples', videoId: '8ext9G7hsp8', order: 5 },
                            { title: 'Dictionaries and Sets', videoId: 'daefaLgNkw0', order: 6 },
                            { title: 'File Handling', videoId: 'Eix_7cZk4Dc', order: 7 },
                            { title: 'Object-Oriented Programming', videoId: 'Ej_06eoA9T8', order: 8 },
                            { title: 'Modules and Packages', videoId: 'CqvZ3vGoGs0', order: 9 },
                            { title: 'Exception Handling', videoId: 'NIWwJbo-9_8', order: 10 },
                            { title: 'Decorators and Generators', videoId: 'FsAPt_9Bf3U', order: 11 },
                            { title: 'NumPy and Pandas', videoId: 'vmEHCJofslg', order: 12 }
                        ]
                    },
                    {
                        key: 'sql',
                        title: 'SQL Database',
                        description: 'Learn SQL from basics to advanced database concepts',
                        icon: '🗄️',
                        videos: [
                            { title: 'SQL Introduction', videoId: 'HXV3zeQKqGY', order: 1 },
                            { title: 'Database Design', videoId: 'FR4QIeZaPeM', order: 2 },
                            { title: 'CREATE and INSERT', videoId: 'WR6aQvM2sS8', order: 3 },
                            { title: 'SELECT Queries', videoId: 'f7npv7q6Wc4', order: 4 },
                            { title: 'WHERE Clause and Conditions', videoId: '3Da9W_UZ8BA', order: 5 },
                            { title: 'JOIN Operations', videoId: '4W70QpuZ7qQ', order: 6 },
                            { title: 'Aggregate Functions', videoId: 'qI-hi2BWzAU', order: 7 },
                            { title: 'GROUP BY and HAVING', videoId: 'k-dR9kP_5Jw', order: 8 },
                            { title: 'Subqueries', videoId: 'pPpTlM1mKsQ', order: 9 },
                            { title: 'Indexes and Performance', videoId: 'jC2tB4GJxqE', order: 10 },
                            { title: 'Database Normalization', videoId: 'GFQaQYBd9s0', order: 11 },
                            { title: 'Advanced SQL Topics', videoId: 'M7qiBcMyE4k', order: 12 }
                        ]
                    }
                ];

                let completed = 0;
                courses.forEach(course => {
                    db.run("INSERT INTO subjects (title, description, icon, course_key) VALUES (?, ?, ?, ?)",
                        [course.title, course.description, course.icon, course.key], function(err) {
                        if (!err) {
                            const subjectId = this.lastID;
                            course.videos.forEach(video => {
                                db.run("INSERT INTO videos (subject_id, title, youtube_video_id, order_index) VALUES (?, ?, ?, ?)",
                                    [subjectId, video.title, video.videoId, video.order]);
                            });
                            completed++;
                            if (completed === courses.length) {
                                console.log('Database initialization completed');
                                // Create default user
                                bcrypt.hash('password123', 10, (err, hash) => {
                                    if (!err) {
                                        db.run("INSERT OR IGNORE INTO users (username, email, password) VALUES (?, ?, ?)",
                                            ['demo', 'demo@lms.com', hash]);
                                        console.log('Default user created');
                                        resolve();
                                    }
                                });
                            }
                        }
                    });
                });
            } else {
                console.log('Database already initialized');
                resolve();
            }
        });
    });
}

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

// Start server
app.listen(PORT, () => {
    console.log(`LMS Server running on http://localhost:${PORT}`);
});
