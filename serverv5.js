const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');
const multer = require('multer');
const { Storage } = require('@google-cloud/storage');
const path = require('path');
const src = path.join(__dirname, "views");
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(express.static(path.join(__dirname, 'public')));
app.use(cors());
app.use(express.json()); // Add this to parse JSON bodies

// Google Cloud Storage configuration
const storage = new Storage({ keyFilename: path.join(__dirname, 'key.json') });
const bucketName = 'gallery-final-ramg-bucket'; // Replace with your Google Cloud Storage bucket name
const bucket = storage.bucket(bucketName);

// Create a connection pool to the database
const pool = mysql.createPool({
  user: 'galleryuser',
  password: 'SecurePass123',
  database: 'gallerydb',
  socketPath: '/cloudsql/gallery-final-ram2025:us-central1:gallery-db'
});

// Setup Multer for memory storage (no filesystem storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // Limit file size to 5MB
  },
});

// API Route to Login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password are required' });

  pool.getConnection((err, connection) => {
    if (err) return res.status(500).json({ error: 'Database connection failed' });

    const query = 'SELECT * FROM users WHERE username = ? AND password = ?';
    connection.execute(query, [username, password], (err, results) => {
      connection.release();
      if (err) return res.status(500).json({ error: 'Query execution failed' });
      if (results.length > 0) return res.status(200).json({ message: 'Login successful', user: results[0] });
      else return res.status(401).json({ error: 'Invalid credentials' });
    });
  });
});

app.post('/api/signup', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password are required' });

  pool.getConnection((err, connection) => {
    if (err) return res.status(500).json({ error: 'Database connection failed' });

    const checkQuery = 'SELECT * FROM users WHERE username = ?';
    connection.execute(checkQuery, [username], (err, results) => {
      if (err) {
        connection.release();
        return res.status(500).json({ error: 'Query execution failed' });
      }
      if (results.length > 0) {
        connection.release();
        return res.status(400).json({ error: 'Username already taken' });
      }

      const id = Math.floor(Math.random() * 1200 + 3);
      const insertQuery = 'INSERT INTO users (id, username, password) VALUES (?, ?, ?)';
      connection.execute(insertQuery, [id, username, password], (err) => {
        connection.release();
        if (err) return res.status(500).json({ error: 'Failed to create user' });
        return res.status(201).json({ message: 'Account created successfully' });
      });
    });
  });
});

app.post('/api/listing', upload.single('image'), async (req, res) => {
  try {
    const jsonData = JSON.parse(req.body.json);
    const blob = bucket.file(`uploads/${uuidv4()}_${req.file.originalname}`);
    const blobStream = blob.createWriteStream({ resumable: false, contentType: req.file.mimetype });

    blobStream.on('finish', async () => {
      try {
        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${blob.name}`;
        const { mainCategory: main, subCategory: sub } = jsonData;

        const insertQuery = 'INSERT INTO items (main, sub, json, imageUrl) VALUES (?, ?, ?, ?)';
        pool.getConnection((err, connection) => {
          if (err) return res.status(500).json({ error: 'Database connection failed' });
          connection.execute(insertQuery, [main, sub, JSON.stringify(jsonData), publicUrl], (err) => {
            connection.release();
            if (err) return res.status(500).json({ error: 'Failed to add item' });
            return res.status(201).json({ success: true, message: 'Item created successfully', listing: jsonData });
          });
        });
      } catch (error) {
        return res.status(500).json({ success: false, message: 'Failed after uploading image.' });
      }
    });

    blobStream.on('error', (err) => {
      return res.status(500).json({ success: false, message: 'Failed to upload image.' });
    });

    blobStream.end(req.file.buffer);
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// BULK INSERT API
app.post('/api/bulk-insert', async (req, res) => {
  const listings = req.body;
  if (!Array.isArray(listings)) return res.status(400).json({ error: 'Expected an array of listings' });

  pool.getConnection((err, connection) => {
    if (err) return res.status(500).json({ error: 'Database connection failed' });

    const insertQuery = 'INSERT INTO items (main, sub, json, imageUrl) VALUES (?, ?, ?, ?)';
    try {
      listings.forEach(item => {
        const { mainCategory: main, subCategory: sub, imageUrl = '' } = item;
        const jsonData = JSON.stringify(item);
        connection.execute(insertQuery, [main, sub, jsonData, imageUrl]);
      });
      connection.release();
      return res.status(200).json({ message: ' Bulk listings inserted successfully.' });
    } catch (err) {
      connection.release();
      return res.status(500).json({ error: 'Failed to insert listings.' });
    }
  });
});

// API Routes to fetch listings by category
['for-sale', 'housing', 'services', 'jobs', 'community'].forEach(route => {
  app.get(`/api/${route}`, (req, res) => {
    pool.getConnection((err, connection) => {
      if (err) return res.status(500).json({ error: 'Database connection failed' });
      const query = `SELECT * FROM items WHERE main='${route.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase())}'`;
      connection.execute(query, [], (err, results) => {
        connection.release();
        if (err) return res.status(500).json({ error: 'Failed to fetch listings' });
        return res.status(200).json({ listings: results });
      });
    });
  });
});

// Serve index.html
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
const PORT = 8080;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
