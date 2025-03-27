const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');
const multer = require('multer');
const { Storage } = require('@google-cloud/storage');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cors());

// Hardcoded database credentials
const DB_USER = 'root';  // Replace with your database username
const DB_PASS = '422';   // Replace with your database password
const DB_NAME = 'project3';  // Replace with your database name
const DB_HOST = '127.0.0.1';  // Cloud SQL Proxy default address or the MySQL server address
const DB_PORT = 3306;  // Default MySQL port

// Google Cloud Storage configuration
const storage = new Storage({
  keyFilename: './key.json', // Replace with your service account key file path
});
const bucketName = 'proj3-bucket'; // Replace with your Google Cloud Storage bucket name
const bucket = storage.bucket(bucketName);

// Create a connection pool to the database
const pool = mysql.createPool({
  host: DB_HOST,
  user: DB_USER,
  password: DB_PASS,
  database: DB_NAME,
  port: DB_PORT,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Set up multer storage configuration to handle file uploads
const storageConfig = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');  // Temporarily save the file to a local folder before uploading to Google Cloud
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));  // Use timestamp as filename
  },
});

const upload = multer({ storage: storageConfig });

// API Route to Login
app.post('/api/login', (req, res) => {
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

    const query = 'SELECT * FROM users WHERE username = ? AND password = ?';
    connection.execute(query, [username, password], (err, results) => {
      connection.release();  // Release the connection back to the pool

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
  });
});

// API Route to upload photo
app.post('/api/upload', upload.single('photo'), (req, res) => {
  const userId = req.body.userId;  // The user ID should be sent along with the photo
  const file = req.file;

  if (!userId || !file) {
    return res.status(400).json({ error: 'User ID and photo are required' });
  }

  // Upload the file to Google Cloud Storage
  const blob = bucket.file(file.filename);
  const blobStream = blob.createWriteStream({
    resumable: false,
  });

  blobStream.on('finish', () => {
    // Make the file publicly accessible (optional)
    const publicUrl = `https://storage.googleapis.com/${bucketName}/${blob.name}`;

    // Save the photo metadata in the database
    pool.getConnection((err, connection) => {
      if (err) {
        console.error('Error getting connection from pool:', err.stack);
        return res.status(500).json({ error: 'Database connection failed' });
      }

      const query = 'INSERT INTO photos (user_id, photo_url) VALUES (?, ?)';
      connection.execute(query, [userId, publicUrl], (err, results) => {
        connection.release();  // Release the connection back to the pool

        if (err) {
          console.error('Error saving photo to database:', err);
          return res.status(500).json({ error: 'Failed to save photo to database' });
        }

        return res.status(200).json({ message: 'Photo uploaded successfully', photoUrl: publicUrl });
      });
    });
  });

  blobStream.on('error', (err) => {
    console.error('Error uploading file to Google Cloud Storage:', err);
    return res.status(500).json({ error: 'Failed to upload photo to Cloud Storage' });
  });

  // Pipe the file data into the Google Cloud Storage stream
  blobStream.end(file.buffer);
});

// API Route to fetch user photos
app.get('/api/photos', (req, res) => {
  const userId = req.query.userId;

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  pool.getConnection((err, connection) => {
    if (err) {
      console.error('Error getting connection from pool:', err.stack);
      return res.status(500).json({ error: 'Database connection failed' });
    }

    const query = 'SELECT * FROM photos WHERE user_id = ?';
    connection.execute(query, [userId], (err, results) => {
      connection.release();  // Release the connection back to the pool

      if (err) {
        console.error('Error fetching photos:', err);
        return res.status(500).json({ error: 'Failed to fetch photos' });
      }

      return res.status(200).json({ photos: results });
    });
  });
});

// Start Server
const PORT = 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

