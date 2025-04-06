const express = require("express");
const app = express();
const port = 3001; // Changed port to 3001
const path = require("path");
const { Storage } = require("@google-cloud/storage");
const Multer = require("multer");
const src = path.join(__dirname, "views");
app.use(express.static(src));

// Setup Multer for memory storage (no filesystem storage)
const multer = Multer({
  storage: Multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // Limit file size to 5MB
  },
});

let projectId = "tribal-pillar-452919-v9"; // Your Google Cloud Project ID
let keyFilename = "./key.json"; // Path to your service account key JSON file
const storage = new Storage({
  projectId,
  keyFilename,
});
const bucket = storage.bucket("proj3-bucket"); // Your Cloud Storage bucket name

// Route to get all files in the bucket
app.get("/upload", async (req, res) => {
  try {
    const [files] = await bucket.getFiles();
    res.send(files); // Send the list of files to the client
    console.log("Success");
  } catch (error) {
    res.send("Error: " + error);
  }
});

// Route to handle file uploads
app.post("/upload", multer.single("imgfile"), async (req, res) => {
  console.log("Made it to /upload");

  try {
    if (req.file) {
      console.log("File found, attempting upload...");

      const blob = bucket.file(req.file.originalname);
      const blobStream = blob.createWriteStream({
        metadata: {
          contentType: req.file.mimetype, // Use the MIME type of the uploaded file
        },
      });

      blobStream.on("finish", async () => {
        try {
          // After the upload is finished, make the file publicly accessible
          await blob.acl.add({
            entity: "allUsers", // Grant public read access to anyone
            role: "READER",
          });

          const publicUrl = `https://storage.googleapis.com/${bucket.name}/${blob.name}`;
          res.status(200).send({ message: "File uploaded successfully!", url: publicUrl });
          console.log("Success");
        } catch (error) {
          console.error("Error setting ACL:", error);
          res.status(500).send("Error making file public.");
        }
      });

      blobStream.on("error", (error) => {
        console.error("Error during upload:", error);
        res.status(500).send(error);
      });

      // Write the file buffer to the stream
      blobStream.end(req.file.buffer);
    } else {
      throw new Error("No file found.");
    }
  } catch (error) {
    console.error("Error during upload:", error);
    res.status(500).send("Error uploading file: " + error.message);
  }
});

// Serve the main index HTML file
app.get("/", (req, res) => {
  res.sendFile(src + "/index.html");
});

// Start the server on port 3001
app.listen(port, () => {
  console.log(`Server started on port ${port}`);
});

