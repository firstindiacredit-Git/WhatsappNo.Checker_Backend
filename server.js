const express = require('express');
const cors = require('cors');
const { getWhatsAppClient } = require('./whatsapp/whatsapp-client');
const apiRoutes = require('./routes/api');
const path = require('path');

// एक्सप्रेस एप्लिकेशन
const app = express();
const PORT = process.env.PORT || 4000;

// मिडलवेयर
app.use(cors({
    origin: ['http://localhost:5173', 'http://13.60.87.164:4000', 'https://whatsapp.pizeonfly.com'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// हेल्थ चेक रूट
app.get('/check', (req, res) => {
    res.json({
        status: 'ok',
        message: 'WhatsApp Number Checker API',
        timestamp: new Date().toISOString()
    });
});

// API रूट्स
app.use('/api/whatsapp', apiRoutes);

// Static files for production
app.use(express.static(path.join(__dirname, 'dist')));

// Catch all route for SPA
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: err.message
    });
});

// सर्वर शुरू करें
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📱 API available at http://localhost:${PORT}`);
    
    // WhatsApp क्लाइंट प्रारंभ करें
    console.log('🔗 Initializing WhatsApp client...');
    initializeWhatsApp();
});

// WhatsApp initialization function
async function initializeWhatsApp() {
    try {
        await getWhatsAppClient();
        console.log('✅ WhatsApp client initialized successfully!');
    } catch (error) {
        console.error('❌ Failed to initialize WhatsApp client:', error.message);
        console.log('⚠️  Server will continue running without WhatsApp. Please restart to try again.');
    }
}

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(() => {
        console.log('Process terminated');
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    server.close(() => {
        console.log('Process terminated');
    });
});

