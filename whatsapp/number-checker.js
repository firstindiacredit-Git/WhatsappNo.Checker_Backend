const { getWhatsAppClient } = require('./whatsapp-client');

// नंबर फॉर्मैटिंग समारोह
const formatNumber = (number) => {
    // नंबर से सभी विशेष चरित्र हटाएं
    const cleaned = number.replace(/[^\d+]/g, '');
    
    // अगर नंबर पहले से ही + से शुरू होता है
    if (cleaned.startsWith('+')) {
        return cleaned;
    }
    
    // अगर नंबर देश कोड से शुरू होता है (जैसे 91, 1, 44, आदि)
    const countryCodePatterns = {
        '91': 12, // India (91 + 10 digits)
        '1': 11,  // USA/Canada (1 + 10 digits)
        '44': 12, // UK (44 + 10 digits)
        '86': 13, // China (86 + 11 digits)
        '81': 12, // Japan (81 + 10 digits)
        '49': 12, // Germany (49 + 10 digits)
        '33': 11, // France (33 + 9 digits)
        '61': 12, // Australia (61 + 10 digits)

    };

    // Check if number starts with any known country code
    for (const [code, length] of Object.entries(countryCodePatterns)) {
        if (cleaned.startsWith(code) && cleaned.length >= length) {
            return '+' + cleaned;
        }
    }
    
    // If no country code is detected and length is 10, assume it's Indian
    if (cleaned.length === 10) {
        return '+91' + cleaned;
    }
    
    // If we can't determine the format, just add + prefix
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
    
    // Check for various country formats
    const countryFormats = {
        // India
        '91': [
            { pattern: /^91\d{10}$/, format: num => `+${num}` },
            { pattern: /^\d{10}$/, format: num => `+91${num}` }
        ],
        // USA/Canada
        '1': [
            { pattern: /^1\d{10}$/, format: num => `+${num}` },
            { pattern: /^\d{10}$/, format: num => `+1${num}` }
        ],
        // UK
        '44': [
            { pattern: /^44\d{10}$/, format: num => `+${num}` },
            { pattern: /^\d{10}$/, format: num => `+44${num}` }
        ],
        // Add more countries as needed
    };

    // Generate formats for each country pattern
    for (const patterns of Object.values(countryFormats)) {
        patterns.forEach(({ pattern, format }) => {
            if (pattern.test(digitsOnly)) {
                formats.add(format(digitsOnly));
            }
        });
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
            
            // थोड़ा ज्यादा इंतरवल रखें ताकि रेट लिमिट से बचें
            await new Promise(resolve => setTimeout(resolve, 1000));
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
            
            // इंतरवल को बढ़ाएं
            await new Promise(resolve => setTimeout(resolve, 1000)); // 1 सेकंड का इंतरवल
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
