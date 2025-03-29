const { getWhatsAppClient } = require('./whatsapp-client');

// नंबर फॉर्मैटिंग समारोह
const formatNumber = (number) => {
    // नंबर से सभी विशेष चरित्र हटाएं
    const cleaned = number.replace(/[^\d+]/g, '');
    
    // अगर नंबर पहले से ही + से शुरू होता है
    if (cleaned.startsWith('+')) {
        return cleaned;
    }
    
    // अगर नंबर 91 से शुरू होता है (भारतीय देश कोड)
    if (cleaned.startsWith('91') && cleaned.length >= 12) {
        return '+' + cleaned;
    }
    
    // अगर नंबर 10 अंकों का है (भारतीय नंबर)
    if (cleaned.length === 10) {
        return '+91' + cleaned;
    }
    
    // डिफ़ॉल्ट: जैसा है वैसा वापस करें
    return '+' + cleaned;
};

// नंबर के विभिन्न संभावित प्रारूप उत्पन्न करें
const generateNumberFormats = (number) => {
    const formats = new Set();
    
    // सभी गैर-अंकीय वर्णों को हटाएं
    const digitsOnly = number.replace(/\D/g, '');
    
    // मूल नंबर जोड़ें
    formats.add(number.trim());
    
    // अगर नंबर + से शुरू नहीं होता
    if (!number.startsWith('+')) {
        formats.add(`+${number.trim()}`);
    }
    
    // केवल अंक
    formats.add(digitsOnly);
    
    // भारतीय नंबर के लिए प्रारूप (10 अंक)
    if (digitsOnly.length === 10) {
        formats.add(`+91${digitsOnly}`);
        formats.add(`91${digitsOnly}`);
    }
    
    // पहले से ही देश कोड के साथ (12 अंक)
    else if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) {
        formats.add(`+${digitsOnly}`);
        formats.add(digitsOnly);
        formats.add(digitsOnly.substring(2));
    }
    
    return [...formats];
};

// नंबर WhatsApp पर है या नहीं की जाँच करें
const checkNumber = async (number) => {
    try {
        const client = await getWhatsAppClient();
        const formattedNumber = formatNumber(number);
        const formats = generateNumberFormats(number);
        
        console.log(`Checking number: ${number} (formatted as: ${formattedNumber})`);
        console.log(`Testing formats: ${formats.join(', ')}`);
        
        // जाँचें क्या कोई फॉर्मेट WhatsApp पर मौजूद है
        for (const format of formats) {
            try {
                const result = await client.onWhatsApp(format);
                console.log(`Result for ${format}:`, result);
                
                // अगर नंबर मिल गया
                if (Array.isArray(result) && result.length > 0 && result[0].exists) {
                    return {
                        number: number,
                        formattedNumber: format,
                        exists: true,
                        info: result[0]
                    };
                }
            } catch (err) {
                console.log(`Error checking format ${format}:`, err.message);
            }
            
            // थोड़ा रुकें ताकि WhatsApp API ब्लॉक न करे
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        // कोई भी फॉर्मेट मौजूद नहीं है
        return {
            number: number,
            formattedNumber: formattedNumber,
            exists: false,
            info: null
        };
    } catch (error) {
        console.error(`Error checking number ${number}:`, error);
        return {
            number: number,
            formattedNumber: formatNumber(number),
            exists: false,
            error: error.message
        };
    }
};

// कई नंबरों की जाँच करें
const checkNumbers = async (numbers) => {
    const results = [];
    
    for (const number of numbers) {
        try {
            const result = await checkNumber(number);
            results.push(result);
            
            // थोड़ा इंतजार करें ताकि WhatsApp API ब्लॉक न करे
            await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
            console.error(`Error checking number ${number}:`, error);
            results.push({
                number: number,
                formattedNumber: formatNumber(number),
                exists: false,
                error: error.message
            });
        }
    }
    
    return results;
};

module.exports = {
    checkNumber,
    checkNumbers,
    formatNumber
};
