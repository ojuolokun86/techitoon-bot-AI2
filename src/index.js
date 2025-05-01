console.log = function () {};
require('dotenv').config();
const qrcode = require('qrcode-terminal');
require('./sync-version');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { logInfo, logError } = require('./utils/logger');
const { startMainBot, startSecurityBot } = require('./bot/bot'); // Import startMainBot and startSecurityBot from bot.js
const pino = require('pino');
let shouldReconnect = true; // Flag to control reconnection

const startBot = async () => {
    try {
        console.log('🚀 Starting Techitoon Bot...');
        
        console.log('🔄 Fetching authentication state...');
        const { state, saveCreds } = await useMultiFileAuthState('auth_info');
        console.log('✅ Authentication state fetched.');

        console.log('🔄 Creating WhatsApp socket...');
        const sock = makeWASocket({
            browser: ['Techitoon', 'Linux', '10.0'],
            auth: state,
            logger: pino({ level: 'silent' }) // ✅ disables all Baileys logs properly
        });
        console.log('✅ WhatsApp socket created.');

        // Start the main bot
        console.log('🔄 Starting main bot...');
        await startMainBot(sock);
        console.log('✅ Main bot started.');

        // Start the security bot
        console.log('🔄 Starting security bot...');
        await startSecurityBot(sock);
        console.log('✅ Security bot started.');

        // Handle connection updates
        sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect, qr } = update;
        
            if (qr) {
                console.log('📱 Scan this QR code to log in:');
                qrcode.generate(qr, { small: true }); // prints in terminal
            }
            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const reconnect = shouldReconnect && statusCode !== DisconnectReason.loggedOut;

                if (statusCode) {
                    logError(`Connection closed with status code ${statusCode}: ${lastDisconnect.error}`);
                } else {
                    logError(`Connection closed due to an unknown error: ${lastDisconnect.error}`);
                }

                console.log(`Reconnection attempt: ${reconnect}`);
                if (reconnect) {
                    startBot();
                } else {
                    console.log('❌ Reconnection has been disabled or not allowed.');
                }
            } else if (connection === 'open') {
                logInfo('✅ Techitoon Bot is ready!');
            } else if (connection === 'connecting') {
                console.log('🔄 Connecting to WhatsApp...');
            } else if (connection === 'qr') {
                console.log('📱 QR code received, please scan it.');
            }
        });

        sock.ev.on('creds.update', saveCreds);
        console.log('✅ Credentials update handler set.');

        console.log('🎉 Techitoon Bot is fully started!');
    } catch (error) {
        console.error('❌ Fatal error in startBot():', error);
    }
};

// Stop reconnection by setting the flag to false when needed
const stopReconnection = () => {
    shouldReconnect = false;
    console.log('❌ Reconnection has been disabled.');
};

startBot();