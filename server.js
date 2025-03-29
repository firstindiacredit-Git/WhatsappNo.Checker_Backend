const express = require('express');
const cors = require('cors');
const { getWhatsAppClient } = require('./whatsapp/whatsapp-client');
const apiRoutes = require('./routes/api');

// एक्सप्रेस एप्लिकेशन
const app = express();
const PORT = process.env.PORT || 5000;

// मिडलवेयर
app.use(cors());
app.use(express.json());

// हेल्थ चेक रूट
app.get('/', (req, res) => {
    res.json({
        status: 'ok',
        message: 'WhatsApp Number Checker API',
        timestamp: new Date().toISOString()
    });
});

// API रूट्स
app.use('/api/whatsapp', apiRoutes);

// सर्वर शुरू करें
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    
    // WhatsApp क्लाइंट प्रारंभ करें
    console.log('Initializing WhatsApp client...');
    getWhatsAppClient()
        .then(() => {
            console.log('WhatsApp client initialized successfully!');
        })
        .catch(error => {
            console.error('Failed to initialize WhatsApp client:', error.message);
            console.log('Server will continue running without WhatsApp. Please restart to try again.');
        });
});

