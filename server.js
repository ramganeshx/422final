const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');

const app = express();
app.use(express.json());
app.use(cors());

// Hardcoded database credentials
const DB_USER = 'root';  // Replace with your database username
const DB_PASS = '422';   // Replace with your database password
const DB_NAME = 'project3';  // Replace with your database name
const DB_HOST = '127.0.0.1';  // Cloud SQL Proxy default address or the MySQL server address
const DB_PORT = 3306;  // Default MySQL port

// Create a connection to the database
const connection = mysql.createConnection({
  host: DB_HOST,
  user: DB_USER,
  password: DB_PASS,
  database: DB_NAME,
  port: DB_PORT,
});

// API Route to Login
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    // Validate input
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    // Attempt to connect and query the database
    connection.connect((err) => {
        if (err) {
            console.error('Error connecting to the database:', err.stack);
            return res.status(500).json({ error: 'Database connection failed' });
        }

        const query = 'SELECT * FROM users WHERE username = ? AND password = ?';
        connection.execute(query, [username, password], (err, results) => {
            if (err) {
                console.error('Error executing query:', err);
                return res.status(500).json({ error: 'Query execution failed' });
            }

            if (results.length > 0) {
                return res.status(200).json({ message: 'Login successful', user: results[0] });
            } else {
                return res.status(401).json({ error: 'Invalid credentials' });
            }
        });

        // Close the connection after the query is executed
        connection.end();
    });
});

app.get('/api/photos', (req, res) => {
    const userId = req.query.userId;

    if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
    }

    const query = 'SELECT * FROM photos WHERE user_id = ?';
    connection.execute(query, [userId], (err, results) => {
        if (err) {
            console.error('Error fetching photos:', err);
            return res.status(500).json({ error: 'Failed to fetch photos' });
        }

        return res.status(200).json({ photos: results });
    });
});
// Start Server
const PORT = 5000;  // Hardcoded port value
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
