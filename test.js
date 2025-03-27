// testConnection.js
const mysql =  require('mysql2');

// Create a connection to the database
const connection = mysql.createConnection({
  host: '127.0.0.1', // Cloud SQL Proxy default address
  user: 'root',
  password: '422',
  database: 'project3',
  port: 3306, // Default MySQL port
});

// Attempt to connect to the database
connection.connect((err) => {
  if (err) {
    console.error('Error connecting to the database:', err.stack);
    return;
  }
  console.log('Connected to the database as id', connection.threadId);
});

// Close the connection
connection.end();
