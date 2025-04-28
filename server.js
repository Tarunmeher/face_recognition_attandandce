const express = require('express');
const mysql = require('mysql2');
const multer = require('multer');
const path = require('path');
const bodyParser = require('body-parser');
const fs = require('fs');

const app = express();
const port = 3000;
const db = require('./db');

app.use(express.static('public'));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
// Multer for image upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'public/images'),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage });

// Registration endpoint
app.post('/api/register', upload.single('photo'), (req, res) => {
  const { name } = req.body;
  const imagePath = `/images/${req.file.filename}`;

  const query = 'INSERT INTO users (name, image_path) VALUES (?, ?)';
  db.query(query, [name, imagePath], (err, result) => {
    if (err) return res.status(500).send('DB Error');
    res.json({ message: 'Registered successfully' });
  });
});

app.get('/api/getUsers', (req, res) => {
  db.query('SELECT image_path FROM users', [], (err, results) => {
    if (err || results.length === 0) return res.status(400).send('User not found');
    res.json({ message: 'success', users:results });
  });
});

// Attendance endpoint
app.post('/api/attendance', (req, res) => {
  const { name } = req.body;

  db.query('SELECT id FROM users WHERE name = ?', [name], (err, results) => {
    if (err || results.length === 0) return res.status(400).send('User not found');

    const userId = results[0].id;
    db.query('INSERT INTO attendance (user_id) VALUES (?)', [userId], err => {
      if (err) return res.status(500).send('Attendance failed');
      res.json({ message: 'Attendance marked' });
    });
  });
});

app.listen(port, () => console.log(`Server running at http://localhost:${port}`));
