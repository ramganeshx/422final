const express = require('express');
const mysql = require('mysql2');
const session = require('express-session');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cors()); // Allow CORS if needed
app.use(express.static(path.join(__dirname, 'public')));

// Session middleware setup
app.use(
  session({
    secret: 'your_secret_key', // Set a secure secret key
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }, // Set to `true` in production if using https
  })
);

const pool = mysql.createPool({
  host: 'your-database-host',
  user: 'your-database-user',
  password: 'your-database-password',
  database: 'your-database-name',
});

// Login API
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  pool.getConnection((err, connection) => {
    if (err) {
      console.error('Error getting connection from pool:', err.stack);
      return res.status(500).json({ error: 'Database connection failed' });
    }

    const query = 'SELECT * FROM users WHERE username = ? AND password = ?';
    connection.execute(query, [username, password], (err, results) => {
      connection.release(); // Release the connection back to the pool

      if (err) {
        console.error('Error executing query:', err);
        return res.status(500).json({ error: 'Query execution failed' });
      }

      if (results.length > 0) {
        // Store user info in session if login is successful
        req.session.user = { username }; // Store session data
        return res.status(200).json({ message: 'Login successful', user: results[0] });
      } else {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
    });
  });
});

// Signup API
app.post('/api/signup', (req, res) => {
  const { username, password } = req.body;

  // Validate input
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  pool.getConnection((err, connection) => {
    if (err) {
      console.error('Error getting connection from pool:', err.stack);
      return res.status(500).json({ error: 'Database connection failed' });
    }

    // Check if the username already exists
    const checkQuery = 'SELECT * FROM users WHERE username = ?';
    connection.execute(checkQuery, [username], (err, results) => {
      if (err) {
        connection.release();
        console.error('Error executing query:', err);
        return res.status(500).json({ error: 'Query execution failed' });
      }

      if (results.length > 0) {
        connection.release();
        return res.status(400).json({ error: 'Username already taken' });
      }

      // Insert the new user into the database without encryption
      const insertQuery = 'INSERT INTO users (username, password) VALUES (?, ?)';
      connection.execute(insertQuery, [username, password], (err, results) => {
        connection.release(); // Release the connection back to the pool

        if (err) {
          console.error('Error executing insert query:', err);
          return res.status(500).json({ error: 'Failed to create user' });
        }

        return res.status(201).json({ message: 'Account created successfully' });
      });
    });
  });
});

// Logout API
app.post('/api/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to log out' });
    }
    res.status(200).json({ message: 'Logged out successfully' });
  });
});

app.listen(5000, () => {
  console.log('Server running on port 5000');
});

