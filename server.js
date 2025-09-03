const express = require('express');
const cors = require('cors');
const { connectDB } = require('./config/database');
const systemRoutes = require('./routes/system');
const emailRoutes = require('./routes/emails');
const errorHandler = require('./middleware/errorHandler');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8000; // Changed to match frontend's default

// Middleware
app.use(express.json());
app.use(cors({
    origin: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : '*',
    credentials: true
}));

// Routes
app.use('/api', systemRoutes);
app.use('/api/emails', emailRoutes);

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('Shutting down gracefully...');
    process.exit(0);
});

// Start server
async function startServer() {
    try {
        await connectDB();
        
        app.listen(PORT, () => {
            console.log(`Email Analysis System running on port ${PORT}`);
            console.log(`API available at http://localhost:${PORT}/api`);
            console.log(`Frontend should connect to: http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();