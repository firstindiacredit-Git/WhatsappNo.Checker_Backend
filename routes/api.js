const express = require('express');
const router = express.Router();
const { checkNumbers } = require('../whatsapp/number-checker');
const { sendMessages } = require('../whatsapp/message-sender');
const { getConnectionStatus, clearSession, getQRCode, disconnectWhatsApp } = require('../whatsapp/whatsapp-client');
const QRCode = require('qrcode');

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

// बल्क मैसेज सेंड एंडपॉइंट
router.post('/send', async (req, res) => {
    try {
        const { numbers, message } = req.body;

        if (!numbers || !Array.isArray(numbers) || numbers.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Please provide an array of phone numbers'
            });
        }

        if (!message || typeof message !== 'string' || message.trim().length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Please provide a non-empty message string'
            });
        }

        if (numbers.length > 100) {
            return res.status(400).json({
                success: false,
                error: 'Maximum 100 numbers can be messaged at once'
            });
        }

        // Check connection status with retry
        let status = getConnectionStatus();
        console.log('🔍 Initial connection status check:', status);
        
        // If not connected, wait a bit and retry once
        if (!status.connected) {
            console.log('⏳ Waiting 2 seconds and retrying connection check...');
            await new Promise(resolve => setTimeout(resolve, 2000));
            status = getConnectionStatus();
            console.log('🔍 Retry connection status check:', status);
        }
        
        if (!status.connected) {
            console.log('❌ WhatsApp not connected after retry. Status:', status);
            return res.status(503).json({
                success: false,
                error: 'WhatsApp is not connected. Please try again later.',
                status: 'disconnected',
                details: status
            });
        }
        
        console.log('✅ WhatsApp is connected, proceeding with message send');
        console.log('✉️  Sending messages to', numbers.length, 'numbers');
        const results = await sendMessages(numbers, message);

        const totalSent = results.filter(r => r.status === 'sent').length;
        const totalFailed = results.length - totalSent;

        res.json({
            success: true,
            results,
            totalSent,
            totalFailed,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Error in /send endpoint:', error);
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

// WhatsApp से disconnect करें और नया QR code generate करें
router.post('/disconnect', async (req, res) => {
    try {
        console.log('🔌 Disconnect request received...');
        const result = await disconnectWhatsApp();
        
        if (result.success) {
            res.json({
                success: true,
                message: 'Successfully disconnected from WhatsApp. You can now scan a new QR code to connect with a different account.',
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(500).json({
                success: false,
                error: result.error,
                timestamp: new Date().toISOString()
            });
        }
    } catch (error) {
        console.error('❌ Error in disconnect endpoint:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// QR कोड एंडपॉइंट
router.get('/qr', async (req, res) => {
    try {
        const qrData = getQRCode();
        if (qrData && qrData.qr) {
            // Generate QR code as SVG
            const qrSvg = await QRCode.toString(qrData.qr, {
                type: 'svg',
                width: 256,
                margin: 2,
                color: {
                    dark: '#000000',
                    light: '#FFFFFF'
                }
            });
            
            res.json({
                success: true,
                qr: qrSvg,
                timestamp: qrData.timestamp,
                expiresIn: qrData.expiresIn,
                message: 'QR code available for scanning'
            });
        } else {
            res.json({
                success: false,
                message: 'No QR code available. WhatsApp might already be connected or QR code expired.',
                timestamp: new Date().toISOString()
            });
        }
    } catch (error) {
        console.error('❌ Error in QR endpoint:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Health check endpoint
router.get('/health', (req, res) => {
    const status = getConnectionStatus();
    res.json({
        success: true,
        status: 'healthy',
        whatsapp: status,
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Test WhatsApp connection endpoint
router.get('/test-connection', (req, res) => {
    const status = getConnectionStatus();
    console.log('🧪 Test connection status:', status);
    res.json({
        success: true,
        connection: status,
        timestamp: new Date().toISOString()
    });
});

module.exports = router;
