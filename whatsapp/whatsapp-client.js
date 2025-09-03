const { default: makeWASocket, useMultiFileAuthState, Browsers, DisconnectReason } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const pino = require('pino');

// गुप्त सत्र डेटा का फोल्डर
const SESSION_DIR = path.join(__dirname, '../session');

// सिंगल इंस्टेंस क्लाइंट
let waSocket = null;
let isConnected = false;
let connectionAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_INTERVAL = 10000; // 10 सेकंड

// QR code storage
let currentQRCode = null;
let qrCodeTimestamp = null;

// लॉगर को केवल गंभीर त्रुटियों के लिए कॉन्फिगर करें
const logger = pino({ 
    level: 'error',
    transport: {
        target: 'pino-pretty',
        options: {
            colorize: true
        }
    }
});

// सत्र फोल्डर बनाएं अगर मौजूद नहीं है
if (!fs.existsSync(SESSION_DIR)) {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
}

// कनेक्शन और इवेंट हैंडलर्स सेट करें
const setupSocketEvents = (sock, resolve, reject) => {
    let hasResolved = false;

    // क्रेडेंशियल्स अपडेट इवेंट
    sock.ev.on('creds.update', saveCredentials);

    // कनेक्शन अपडेट इवेंट
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        // कनेक्शन स्थिति अपडेट
        if (connection) {
            console.log(`📱 WhatsApp connection status: ${connection}`);
            
            if (connection === 'open') {
                console.log('✅ Connected to WhatsApp!');
                isConnected = true;
                connectionAttempts = 0;
                currentQRCode = null; // Clear QR code when connected
                qrCodeTimestamp = null;
                
                if (!hasResolved) {
                    hasResolved = true;
                    resolve(sock);
                }
            } else if (connection === 'close') {
                isConnected = false;
                
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const reason = lastDisconnect?.error?.output?.payload?.error;
                console.log(`❌ Disconnected from WhatsApp. Status code: ${statusCode}, Reason: ${reason}`);

                // लॉग आउट या अधिकृत उपकरण की अस्वीकृति
                if (statusCode === DisconnectReason.loggedOut || statusCode === 403) {
                    console.log('🔐 Session expired or logged out. Clearing session data.');
                    clearSession();
                    currentQRCode = null;
                    qrCodeTimestamp = null;
                    
                    if (!hasResolved) {
                        hasResolved = true;
                        reject(new Error('WhatsApp session expired or logged out'));
                    }
                } else if (connectionAttempts < MAX_RECONNECT_ATTEMPTS) {
                    // पुनः प्रयास
                    connectionAttempts++;
                    console.log(`🔄 Attempting to reconnect (${connectionAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
                    
                    setTimeout(() => {
                        initWhatsApp().then(newSock => {
                            waSocket = newSock;
                            if (!hasResolved) {
                                hasResolved = true;
                                resolve(newSock);
                            }
                        }).catch(error => {
                            if (!hasResolved) {
                                hasResolved = true;
                                reject(error);
                            }
                        });
                    }, RECONNECT_INTERVAL);
                } else if (!hasResolved) {
                    hasResolved = true;
                    reject(new Error('Maximum reconnection attempts reached'));
                }
            }
        }

        // QR कोड प्रदर्शित करें और store करें
        if (qr) {
            console.log('\n\n=== 📱 SCAN THIS QR CODE TO LOGIN ===\n');
            require('qrcode-terminal').generate(qr, { small: true });
            console.log('\n======================================\n');
            
            // Store QR code for frontend
            currentQRCode = qr;
            qrCodeTimestamp = new Date().toISOString();
        }
    });
};

// सेव क्रेडेंशियल्स हैंडलर
let saveCredentials; 

// WhatsApp क्लाइंट शुरू करें
const initWhatsApp = async () => {
    try {
        console.log('🚀 Starting WhatsApp client...');
        
        // auth स्टेट प्राप्त करें
        const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
        saveCredentials = saveCreds;
        
        // नया सॉकेट क्लाइंट बनाएं
        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            browser: Browsers.macOS('Chrome'),
            logger,
            markOnlineOnConnect: false,
            connectTimeoutMs: 60000,  // 1 minute timeout
            defaultQueryTimeoutMs: 60000,  // 1 minute timeout
            syncFullHistory: false,
            retryRequestDelayMs: 2000,
            maxRetries: 3
        });
        
        // प्रॉमिस प्रदान करें जो सफल कनेक्शन पर रिज़ॉल्व होगा
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                reject(new Error('WhatsApp connection timeout after 1 minute'));
            }, 60000); // 1 minute
            
            // इवेंट लिसनर्स सेटअप करें
            setupSocketEvents(sock, (resolvedSock) => {
                clearTimeout(timeoutId);
                resolve(resolvedSock);
            }, (error) => {
                clearTimeout(timeoutId);
                reject(error);
            });
        });
    } catch (error) {
        console.error('❌ Failed to initialize WhatsApp:', error);
        throw error;
    }
};

// सत्र डेटा साफ करें
const clearSession = () => {
    try {
        if (fs.existsSync(SESSION_DIR)) {
            fs.rmSync(SESSION_DIR, { recursive: true, force: true });
            fs.mkdirSync(SESSION_DIR, { recursive: true });
            console.log('🧹 Session data cleared successfully');
        }
        currentQRCode = null;
        qrCodeTimestamp = null;
    } catch (error) {
        console.error('❌ Error clearing session data:', error);
    }
};

// WhatsApp से disconnect करें और नया QR code generate करें
const disconnectWhatsApp = async () => {
    try {
        console.log('🔌 Disconnecting from WhatsApp...');
        
        // Close the current socket if it exists
        if (waSocket) {
            try {
                await waSocket.logout();
                console.log('✅ Successfully logged out from WhatsApp');
            } catch (error) {
                console.log('⚠️ Error during logout:', error.message);
            }
        }
        
        // Clear session data
        clearSession();
        
        // Reset connection state
        waSocket = null;
        isConnected = false;
        connectionAttempts = 0;
        
        // Initialize new WhatsApp client to get QR code
        console.log('🔄 Initializing new WhatsApp client for QR code...');
        waSocket = await initWhatsApp();
        
        return {
            success: true,
            message: 'Successfully disconnected and ready for new connection',
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        console.error('❌ Error disconnecting WhatsApp:', error);
        return {
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        };
    }
};

// WhatsApp क्लाइंट प्राप्त करें
const getWhatsAppClient = async (forceReconnect = false) => {
    if (!waSocket || !isConnected || forceReconnect) {
        try {
            waSocket = await initWhatsApp();
        } catch (error) {
            console.error('❌ Error getting WhatsApp client:', error);
            throw error;
        }
    }
    return waSocket;
};

// कनेक्शन स्थिति प्राप्त करें
const getConnectionStatus = () => {
    // Double check connection status
    const actualConnected = isConnected && waSocket && waSocket.user;
    
    return {
        connected: actualConnected ? waSocket.user : false,
        socket: waSocket ? true : false,
        attempts: connectionAttempts,
        user: waSocket?.user ? true : false
    };
};

// QR कोड प्राप्त करें
const getQRCode = () => {
    // Check if QR code is still valid (not older than 2 minutes)
    if (currentQRCode && qrCodeTimestamp) {
        const qrAge = Date.now() - new Date(qrCodeTimestamp).getTime();
        if (qrAge < 120000) { // 2 minutes
            return {
                qr: currentQRCode,
                timestamp: qrCodeTimestamp,
                expiresIn: Math.max(0, 120000 - qrAge)
            };
        }
    }
    return null;
};

module.exports = {
    getWhatsAppClient,
    getConnectionStatus,
    clearSession,
    getQRCode,
    disconnectWhatsApp
};
