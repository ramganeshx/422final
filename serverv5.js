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
const storage = new Storage();
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

app.post('/api/listing', upload.single('image'), async (req, res) => {
  try {
    const jsonData = JSON.parse(req.body.json);

    const blob = bucket.file(`uploads/${uuidv4()}_${req.file.originalname}`);
    const blobStream = blob.createWriteStream({
      resumable: false,
      contentType: req.file.mimetype,
    });

    blobStream.on('finish', async () => {
      try {
        await blob.makePublic();
        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${blob.name}`;

        const main = jsonData.mainCategory;
        const sub = jsonData.subCategory;

        const insertQuery = 'INSERT INTO items (main, sub, json, imageUrl) VALUES (?, ?, ?, ?)';
        pool.getConnection((err, connection) => {
          if (err) {
            console.error('Error getting connection from pool:', err.stack);
            return res.status(500).json({ error: 'Database connection failed' });
          }

          connection.execute(insertQuery, [main, sub, JSON.stringify(jsonData), publicUrl], (err, results) => {
            connection.release();

            if (err) {
              console.error('Error executing insert query:', err);
              return res.status(500).json({ error: 'Failed to add item' });
            }

            return res.status(201).json({ success: true, message: 'Item created successfully', listing: jsonData });
          });
        });
      } catch (error) {
        console.error('Upload Finish Error:', error);
        return res.status(500).json({ success: false, message: 'Failed after uploading image.' });
      }
    });

    blobStream.on('error', (err) => {
      console.error('Upload Error:', err);
      return res.status(500).json({ success: false, message: 'Failed to upload image.' });
    });

    blobStream.end(req.file.buffer);

  } catch (error) {
    console.error('Server Error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }

});


// API Route to fetch "For Sale" listings
app.get('/api/for-sale', (req, res) => {
  pool.getConnection((err, connection) => {
    if (err) {
      console.error('Error getting connection from pool:', err.stack);
      return res.status(500).json({ error: 'Database connection failed' });
    }

    const query = "SELECT * FROM items WHERE main='For Sale'";
    connection.execute(query, [], (err, results) => {
      connection.release();  // Release the connection back to the pool

      if (err) {
        console.error('Error fetching listings:', err);
        return res.status(500).json({ error: 'Failed to fetch listings' });
      }

      return res.status(200).json({ listings: results });
    });
  });
});

// API Route to fetch "Housing" listings
app.get('/api/housing', (req, res) => {
  pool.getConnection((err, connection) => {
    if (err) {
      console.error('Error getting connection from pool:', err.stack);
      return res.status(500).json({ error: 'Database connection failed' });
    }

    const query = "SELECT * FROM items WHERE main='Housing'";
    connection.execute(query, [], (err, results) => {
      connection.release();  // Release the connection back to the pool

      if (err) {
        console.error('Error fetching listings:', err);
        return res.status(500).json({ error: 'Failed to fetch listings' });
      }

      return res.status(200).json({ listings: results });
    });
  });
});

// API Route to fetch "services" listings
app.get('/api/services', (req, res) => {
  pool.getConnection((err, connection) => {
    if (err) {
      console.error('Error getting connection from pool:', err.stack);
      return res.status(500).json({ error: 'Database connection failed' });
    }

    const query = "SELECT * FROM items WHERE main='Services'";
    connection.execute(query, [], (err, results) => {
      connection.release();  // Release the connection back to the pool

      if (err) {
        console.error('Error fetching listings:', err);
        return res.status(500).json({ error: 'Failed to fetch listings' });
      }

      return res.status(200).json({ listings: results });
    });
  });
});

// API Route to fetch "jobs" listings
app.get('/api/jobs', (req, res) => {
  pool.getConnection((err, connection) => {
    if (err) {
      console.error('Error getting connection from pool:', err.stack);
      return res.status(500).json({ error: 'Database connection failed' });
    }

    const query = "SELECT * FROM items WHERE main='Jobs'";
    connection.execute(query, [], (err, results) => {
      connection.release();  // Release the connection back to the pool

      if (err) {
        console.error('Error fetching listings:', err);
        return res.status(500).json({ error: 'Failed to fetch listings' });
      }

      return res.status(200).json({ listings: results });
    });
  });
});

// API Route to fetch "community" listings
app.get('/api/community', (req, res) => {
  pool.getConnection((err, connection) => {
    if (err) {
      console.error('Error getting connection from pool:', err.stack);
      return res.status(500).json({ error: 'Database connection failed' });
    }

    const query = "SELECT * FROM items WHERE main='Community'";
    connection.execute(query, [], (err, results) => {
      connection.release();  // Release the connection back to the pool

      if (err) {
        console.error('Error fetching listings:', err);
        return res.status(500).json({ error: 'Failed to fetch listings' });
      }

      return res.status(200).json({ listings: results });
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

