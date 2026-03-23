const sqlite3 = require('sqlite3').verbose();

// Production database path for Render
const dbPath = process.env.NODE_ENV === 'production' 
    ? '/opt/render/project/src/lms.db' 
    : './lms.db';

console.log('Setting up database at:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
        process.exit(1);
    }
    
    console.log('Connected to SQLite database');
    
    // Create tables synchronously
    db.serialize(() => {
        // Users table
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Subjects table (courses)
        db.run(`CREATE TABLE IF NOT EXISTS subjects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT,
            icon TEXT,
            course_key TEXT UNIQUE NOT NULL
        )`);

        // Videos table
        db.run(`CREATE TABLE IF NOT EXISTS videos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            subject_id INTEGER,
            title TEXT NOT NULL,
            youtube_video_id TEXT NOT NULL,
            order_index INTEGER,
            duration_seconds INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (subject_id) REFERENCES subjects(id),
            UNIQUE(subject_id, order_index)
        )`);

        // Enrollments table
        db.run(`CREATE TABLE IF NOT EXISTS enrollments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            subject_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (subject_id) REFERENCES subjects(id),
            UNIQUE(user_id, subject_id)
        )`);

        // Video progress table
        db.run(`CREATE TABLE IF NOT EXISTS video_progress (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            video_id INTEGER,
            last_position_seconds INTEGER DEFAULT 0,
            is_completed BOOLEAN DEFAULT 0,
            completed_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (video_id) REFERENCES videos(id),
            UNIQUE(user_id, video_id)
        )`);

        // Refresh tokens table
        db.run(`CREATE TABLE IF NOT EXISTS refresh_tokens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            token_hash TEXT NOT NULL,
            expires_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )`);

        console.log('All tables created successfully');

        // Insert default data
        const bcrypt = require('bcryptjs');
        
        // Default user
        bcrypt.hash('password123', 10, (err, hash) => {
            if (!err) {
                db.run("INSERT OR IGNORE INTO users (username, email, password) VALUES (?, ?, ?)",
                    ['demo', 'demo@lms.com', hash]);
                console.log('Default user created');
            }
        });

        // Default courses
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
            db.run("INSERT INTO subjects (title, description, icon, course_key) VALUES (?, ?, ?)",
                [course.title, course.description, course.icon, course.key], function(err) {
                if (!err) {
                    const subjectId = this.lastID;
                    course.videos.forEach(video => {
                        db.run("INSERT INTO videos (subject_id, title, youtube_video_id, order_index) VALUES (?, ?, ?, ?)",
                            [subjectId, video.title, video.videoId, video.order]);
                    });
                    completed++;
                    if (completed === courses.length) {
                        console.log('Database initialization completed successfully');
                        db.close();
                    }
                }
            });
        });
    });
});
