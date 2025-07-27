const express = require('express');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static(path.join(__dirname, '.')));

// Health check endpoint for Railway
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'healthy', 
        service: 'WebQX Healthcare Platform',
        timestamp: new Date().toISOString()
    });
});

// Serve the main patient portal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Catch all other routes and serve the patient portal
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 WebQX Healthcare Platform is running on port ${PORT}`);
    console.log(`🩺 Patient Portal available at http://localhost:${PORT}`);
    console.log(`💊 Health check endpoint: http://localhost:${PORT}/health`);
});