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
            console.log(`WhatsApp connection status: ${connection}`);
            
            if (connection === 'open') {
                console.log('✅ Connected to WhatsApp!');
                isConnected = true;
                connectionAttempts = 0;
                
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
                    console.log('Session expired or logged out. Clearing session data.');
                    clearSession();
                    
                    if (!hasResolved) {
                        hasResolved = true;
                        reject(new Error('WhatsApp session expired or logged out'));
                    }
                } else if (connectionAttempts < MAX_RECONNECT_ATTEMPTS) {
                    // पुनः प्रयास
                    connectionAttempts++;
                    console.log(`Attempting to reconnect (${connectionAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
                    
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

        // QR कोड प्रदर्शित करें
        if (qr) {
            console.log('\n\n=== SCAN THIS QR CODE TO LOGIN ===\n');
            require('qrcode-terminal').generate(qr, { small: true });
            console.log('\n======================================\n');
        }
    });
};

// सेव क्रेडेंशियल्स हैंडलर
let saveCredentials; 

// WhatsApp क्लाइंट शुरू करें
const initWhatsApp = async () => {
    try {
        console.log('Starting WhatsApp client...');
        
        // auth स्टेट प्राप्त करें
        const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
        saveCredentials = saveCreds;
        
        // नया सॉकेट क्लाइंट बनाएं
        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: false, // हम खुद हैंडल करेंगे
            browser: Browsers.macOS('Chrome'),
            logger,
            markOnlineOnConnect: false,
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 30000,
            syncFullHistory: false
        });
        
        // प्रॉमिस प्रदान करें जो सफल कनेक्शन पर रिज़ॉल्व होगा
        return new Promise((resolve, reject) => {
            // 2 मिनट टाइमआउट सेट करें
            const timeoutId = setTimeout(() => {
                reject(new Error('WhatsApp connection timeout after 2 minutes'));
            }, 120000);
            
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
        console.error('Failed to initialize WhatsApp:', error);
        throw error;
    }
};

// सत्र डेटा साफ करें
const clearSession = () => {
    try {
        if (fs.existsSync(SESSION_DIR)) {
            fs.rmSync(SESSION_DIR, { recursive: true, force: true });
            fs.mkdirSync(SESSION_DIR, { recursive: true });
            console.log('Session data cleared successfully');
        }
    } catch (error) {
        console.error('Error clearing session data:', error);
    }
};

// WhatsApp क्लाइंट प्राप्त करें
const getWhatsAppClient = async (forceReconnect = false) => {
    if (!waSocket || !isConnected || forceReconnect) {
        try {
            waSocket = await initWhatsApp();
        } catch (error) {
            console.error('Error getting WhatsApp client:', error);
            throw error;
        }
    }
    return waSocket;
};

// कनेक्शन स्थिति प्राप्त करें
const getConnectionStatus = () => {
    return {
        connected: isConnected,
        socket: waSocket ? true : false,
        attempts: connectionAttempts
    };
};

module.exports = {
    getWhatsAppClient,
    getConnectionStatus,
    clearSession
};
