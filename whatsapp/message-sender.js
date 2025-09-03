const { getWhatsAppClient } = require('./whatsapp-client');
const { formatNumber } = require('./number-checker');

// Convert formatted phone number (e.g., +919876543210) to WhatsApp JID
const toJid = (formattedNumber) => `${formattedNumber.replace('+', '')}@s.whatsapp.net`;

// Send a single message
const sendMessageToNumber = async (client, number, message) => {
    const formattedNumber = formatNumber(number);
    const jid = toJid(formattedNumber);

    try {
        console.log(`📱 Attempting to send message to: ${formattedNumber}`);
        
        // Verify number exists on WhatsApp first
        const exists = await client.onWhatsApp(formattedNumber);
        if (!Array.isArray(exists) || exists.length === 0 || !exists[0].exists) {
            console.log(`❌ Number ${formattedNumber} not on WhatsApp`);
            return {
                number,
                formattedNumber,
                status: 'failed',
                reason: 'not_on_whatsapp',
                timestamp: new Date().toISOString()
            };
        }

        console.log(`✅ Number ${formattedNumber} verified on WhatsApp, sending message...`);
        await client.sendMessage(jid, { text: message });
        console.log(`✅ Message sent successfully to ${formattedNumber}`);
        
        return {
            number,
            formattedNumber,
            status: 'sent',
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        console.error(`❌ Error sending message to ${formattedNumber}:`, error.message);
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

    console.log(`🚀 Starting bulk message send to ${numbers.length} numbers`);
    console.log(`📝 Message: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`);

    for (let i = 0; i < numbers.length; i++) {
        const number = numbers[i];
        console.log(`\n📞 Processing ${i + 1}/${numbers.length}: ${number}`);
        
        const result = await sendMessageToNumber(client, number, message);
        results.push(result);
        
        // Log progress
        const sentCount = results.filter(r => r.status === 'sent').length;
        const failedCount = results.filter(r => r.status === 'failed').length;
        console.log(`📊 Progress: ${i + 1}/${numbers.length} | ✅ Sent: ${sentCount} | ❌ Failed: ${failedCount}`);
        
        if (i < numbers.length - 1) {
            console.log(`⏳ Waiting 800ms before next message...`);
            await new Promise(resolve => setTimeout(resolve, 800));
        }
    }

    const finalSent = results.filter(r => r.status === 'sent').length;
    const finalFailed = results.filter(r => r.status === 'failed').length;
    console.log(`\n🎉 Bulk message send completed!`);
    console.log(`📊 Final Results: ✅ Sent: ${finalSent} | ❌ Failed: ${finalFailed}`);

    return results;
};

module.exports = {
    sendMessages
};


