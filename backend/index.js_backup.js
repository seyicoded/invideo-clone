const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs-extra');

// Load environment variables
dotenv.config();

// Import routes
const videoRoutes = require('./routes/videoRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ensure required directories exist
const createDirectories = async () => {
  const dirs = [
    path.join(__dirname, 'tmp', 'videos'),
    path.join(__dirname, 'tmp', 'audio'),
    path.join(__dirname, 'output')
  ];
  
  for (const dir of dirs) {
    await fs.ensureDir(dir);
  }
  console.log('✅ Required directories created/verified');
};

// Static files
app.use('/output', express.static(path.join(__dirname, 'output')));
app.use('/tmp', express.static(path.join(__dirname, 'tmp')));

// Routes
app.use('/api/video', videoRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'InVideo AI Clone Backend is running',
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!', 
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
const startServer = async () => {
  try {
    await createDirectories();
    app.listen(PORT, () => {
      console.log(`🚀 InVideo AI Clone Backend running on port ${PORT}`);
      console.log(`📁 Output directory: ${path.join(__dirname, 'output')}`);
      console.log(`🔗 Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();