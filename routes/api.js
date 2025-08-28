const express = require('express');
const router = express.Router();
const { checkNumbers } = require('../whatsapp/number-checker');
const { getConnectionStatus, clearSession } = require('../whatsapp/whatsapp-client');

// स्टेटस चेक एंडपॉइंट
router.get('/status', (req, res) => {
    try {
        const status = getConnectionStatus();
        console.log('📊 Status check requested:', status);
        
        res.json({
            success: true,
            status: status.connected ? 'connected' : 'disconnected',
            connected: status.connected,
            hasSocket: status.socket,
            attempts: status.attempts,
            timestamp: new Date().toISOString(),
            message: status.connected ? 'WhatsApp is connected and ready' : 'WhatsApp is not connected'
        });
    } catch (error) {
        console.error('❌ Error in status endpoint:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            status: 'error',
            connected: false,
            timestamp: new Date().toISOString()
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
        
        if (numbers.length > 100) {
            return res.status(400).json({
                success: false,
                error: 'Maximum 100 numbers can be checked at once'
            });
        }
        
        console.log('📞 Received request to check numbers:', numbers.length, 'numbers');
        
        const status = getConnectionStatus();
        if (!status.connected) {
            return res.status(503).json({
                success: false,
                error: 'WhatsApp is not connected. Please try again later.',
                status: 'disconnected'
            });
        }
        
        console.log('✅ WhatsApp is connected, starting number check...');
        const results = await checkNumbers(numbers);
        
        console.log('✅ Number check completed:', results.length, 'results');
        
        res.json({
            success: true,
            results: results.map(result => ({
                number: result.number,
                formattedNumber: result.formattedNumber,
                isOnWhatsApp: result.exists,
                details: result.info
            })),
            totalChecked: results.length,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Error in /check endpoint:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// सेशन क्लियर एंडपॉइंट (केवल डेवलपमेंट के लिए)
router.post('/clear-session', (req, res) => {
    try {
        console.log('🧹 Clearing WhatsApp session...');
        clearSession();
        res.json({
            success: true,
            message: 'Session cleared successfully',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Error clearing session:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Health check endpoint
router.get('/health', (req, res) => {
    res.json({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

module.exports = router;
