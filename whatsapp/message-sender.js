const { getWhatsAppClient } = require('./whatsapp-client');
const { formatNumber } = require('./number-checker');

// Convert formatted phone number (e.g., +919876543210) to WhatsApp JID
const toJid = (formattedNumber) => `${formattedNumber.replace('+', '')}@s.whatsapp.net`;

// Send a single message
const sendMessageToNumber = async (client, number, message) => {
    const formattedNumber = formatNumber(number);
    const jid = toJid(formattedNumber);

    try {
        // Verify number exists on WhatsApp first
        const exists = await client.onWhatsApp(formattedNumber);
        if (!Array.isArray(exists) || exists.length === 0 || !exists[0].exists) {
            return {
                number,
                formattedNumber,
                status: 'failed',
                reason: 'not_on_whatsapp',
                timestamp: new Date().toISOString()
            };
        }

        await client.sendMessage(jid, { text: message });
        return {
            number,
            formattedNumber,
            status: 'sent',
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        return {
            number,
            formattedNumber,
            status: 'failed',
            reason: error.message,
            timestamp: new Date().toISOString()
        };
    }
};

// Send messages in bulk with a small delay to avoid rate limits
const sendMessages = async (numbers, message) => {
    const client = await getWhatsAppClient();
    const results = [];

    for (let i = 0; i < numbers.length; i++) {
        const number = numbers[i];
        const result = await sendMessageToNumber(client, number, message);
        results.push(result);
        if (i < numbers.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 800));
        }
    }

    return results;
};

module.exports = {
    sendMessages
};


