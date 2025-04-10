const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');
const multer = require('multer');
const { Storage } = require('@google-cloud/storage');
const path = require('path');
const src = path.join(__dirname, "views");


const app = express();
app.use(express.static(path.join(__dirname, 'public')));
app.use(cors());
app.use(express.json()); // Add this to parse JSON bodies


// Google Cloud Storage configuration
const storage = new Storage({
  keyFilename: './proj4-456020-783da00b791b.json', // Replace with your service account key file path
});
const bucketName = '422proj4-bucket'; // Replace with your Google Cloud Storage bucket name
const bucket = storage.bucket(bucketName);

// Create a connection pool to the database
const pool = mysql.createPool({
  user: 'root',
  password: '422',
  database: 'project4',
  socketPath: `/cloudsql/proj4-456020:us-central1:quickstart-instance`,
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

      id = Math.floor(Math.random() * 1200 + 3);

      // Insert the new user into the database without encryption
      const insertQuery = 'INSERT INTO users (id, username, password) VALUES (?, ?, ?)';
      connection.execute(insertQuery, [id, username, password], (err, results) => {
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


// API Route to upload photo
app.post('/api/upload', upload.single('imgfile'), async (req, res) => {
  const userId = req.body.userId;  // The user ID should be sent along with the photo
  const file = req.file;
  const photoName = req.body.photoName;

  if (!userId || !file) {
    return res.status(400).json({ error: 'User ID and photo are required' });
  }

  try {
    console.log("File found, attempting upload...");

    const blob = bucket.file(file.originalname);
    const blobStream = blob.createWriteStream({
      metadata: {
        contentType: file.mimetype, // Use the MIME type of the uploaded file
      },
    });
    blobStream.on('finish', async () => {
      try {

        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${blob.name}`;
        // Save the photo metadata in the database
        pool.getConnection((err, connection) => {
          if (err) {
            console.error('Error getting connection from pool:', err.stack);
            return res.status(500).json({ error: 'Database connection failed' });
          }

          const query = 'INSERT INTO photos (user_id, photo_url, photo_name) VALUES (?, ?, ?);';
          connection.execute(query, [userId, publicUrl, photoName], (err, results) => {
            connection.release();  // Release the connection back to the pool

            if (err) {
              console.error('Error saving photo to database:', err);
              return res.status(500).json({ error: 'Failed to save photo to database' });
            }

            return res.status(200).json({ message: 'Photo uploaded successfully', photoUrl: publicUrl });
          });
        });

        console.log("File uploaded successfully!");
      } catch (error) {
        console.error("Error during upload:", error);
        res.status(500).send("Error setting ACL or saving file.");
      }
    });

    blobStream.on('error', (error) => {
      console.error("Error during upload:", error);
      res.status(500).send(error);
    });

    // Write the file buffer to the stream
    blobStream.end(file.buffer);
  } catch (error) {
    console.error('Error uploading file:', error);
    return res.status(500).json({ error: 'Failed to upload photo to Cloud Storage' });
  }
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

// Get the main index html file
app.get("/", (req, res) => {
 res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


// Start Server
const PORT = 8080;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

