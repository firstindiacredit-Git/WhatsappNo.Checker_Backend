const express = require('express');
const router = express.Router();
const { checkNumbers } = require('../whatsapp/number-checker');
const { getConnectionStatus, clearSession } = require('../whatsapp/whatsapp-client');

// स्टेटस चेक एंडपॉइंट
router.get('/status', (req, res) => {
    try {
        const status = getConnectionStatus();
        res.json({
            success: true,
            status: status.connected ? 'connected' : 'disconnected',
            connected: status.connected,
            hasSocket: status.socket,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// नंबर चेक एंडपॉइंट
router.post('/check', async (req, res) => {
    try {
        const { numbers } = req.body;
        
        if (!numbers || !Array.isArray(numbers) || numbers.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Please provide an array of phone numbers'
            });
        }
        
        if (numbers.length > 10) {
            return res.status(400).json({
                success: false,
                error: 'Maximum 10 numbers can be checked at once'
            });
        }
        
        console.log('Received request to check numbers:', numbers);
        
        const status = getConnectionStatus();
        if (!status.connected) {
            return res.status(503).json({
                success: false,
                error: 'WhatsApp is not connected. Please try again later.'
            });
        }
        
        const results = await checkNumbers(numbers);
        
        res.json({
            success: true,
            results: results.map(result => ({
                number: result.number,
                formattedNumber: result.formattedNumber,
                isOnWhatsApp: result.exists,
                details: result.info
            }))
        });
    } catch (error) {
        console.error('Error in /check endpoint:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// सेशन क्लियर एंडपॉइंट (केवल डेवलपमेंट के लिए)
router.post('/clear-session', (req, res) => {
    try {
        clearSession();
        res.json({
            success: true,
            message: 'Session cleared successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
