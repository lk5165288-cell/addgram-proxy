const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Telegram Bot Token
const BOT_TOKEN = '8532395139:AAGHhJurz1kkjtyejfdwNd7ntgdehzx30Xc';

// API endpoint: হেলথ চেক
app.get('/api/health', (req, res) => {
    res.json({ 
        success: true, 
        message: '✅ প্রোক্সি সার্ভার চালু আছে',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// API endpoint: বট ইনফো
app.get('/api/bot-info', async (req, res) => {
    try {
        const url = `https://api.telegram.org/bot${BOT_TOKEN}/getMe`;
        const response = await axios.get(url);
        res.json({ success: true, data: response.data });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.response?.data || error.message 
        });
    }
});

// API endpoint: একক মেসেজ পাঠানো
app.post('/api/send-message', async (req, res) => {
    try {
        const { chat_id, text, photo, parse_mode = 'HTML' } = req.body;
        
        if (!chat_id || !text) {
            return res.status(400).json({ 
                success: false, 
                error: 'chat_id এবং text প্রয়োজন' 
            });
        }

        const method = photo ? 'sendPhoto' : 'sendMessage';
        const url = `https://api.telegram.org/bot${BOT_TOKEN}/${method}`;
        
        const payload = {
            chat_id: chat_id,
            parse_mode: parse_mode
        };

        if (photo) {
            payload.photo = photo;
            payload.caption = text;
        } else {
            payload.text = text;
        }

        const response = await axios.post(url, payload);
        res.json({ 
            success: true, 
            data: response.data,
            message: 'মেসেজ সফলভাবে পাঠানো হয়েছে'
        });
        
    } catch (error) {
        console.error('মেসেজ পাঠাতে ত্রুটি:', error.response?.data || error.message);
        res.status(500).json({ 
            success: false, 
            error: error.response?.data || error.message 
        });
    }
});

// API endpoint: একাধিক চ্যানেলে ব্রডকাস্ট
app.post('/api/broadcast', async (req, res) => {
    try {
        const { channels, text, photo, parse_mode = 'HTML' } = req.body;
        
        if (!channels || !text) {
            return res.status(400).json({ 
                success: false, 
                error: 'channels এবং text প্রয়োজন' 
            });
        }

        const channelList = Array.isArray(channels) ? channels : [channels];
        const results = [];
        
        for (const chat_id of channelList) {
            try {
                const method = photo ? 'sendPhoto' : 'sendMessage';
                const url = `https://api.telegram.org/bot${BOT_TOKEN}/${method}`;
                
                const payload = {
                    chat_id: chat_id,
                    parse_mode: parse_mode
                };

                if (photo) {
                    payload.photo = photo;
                    payload.caption = text;
                } else {
                    payload.text = text;
                }

                const response = await axios.post(url, payload);
                results.push({ chat_id: chat_id, success: true, data: response.data });
                
                // Rate limiting
                await new Promise(resolve => setTimeout(resolve, 100));
                
            } catch (error) {
                console.error(`ত্রুটি ${chat_id}:`, error.response?.data || error.message);
                results.push({ 
                    chat_id: chat_id, 
                    success: false, 
                    error: error.response?.data || error.message 
                });
            }
        }

        const successCount = results.filter(r => r.success).length;
        const totalCount = results.length;
        
        res.json({ 
            success: true, 
            results: results,
            summary: {
                total: totalCount,
                success: successCount,
                failed: totalCount - successCount,
                success_rate: ((successCount / totalCount) * 100).toFixed(2) + '%'
            }
        });
        
    } catch (error) {
        console.error('ব্রডকাস্ট ত্রুটি:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// API endpoint: চ্যানেলে বটের স্ট্যাটাস চেক
app.post('/api/check-bot-status', async (req, res) => {
    try {
        const { chat_id } = req.body;
        
        if (!chat_id) {
            return res.status(400).json({ 
                success: false, 
                error: 'chat_id প্রয়োজন' 
            });
        }

        // বট ইনফো নিন
        const botUrl = `https://api.telegram.org/bot${BOT_TOKEN}/getMe`;
        const botResponse = await axios.get(botUrl);
        const botId = botResponse.data.result.id;
        
        // চ্যানেল ইনফো নিন
        const chatUrl = `https://api.telegram.org/bot${BOT_TOKEN}/getChat`;
        const chatResponse = await axios.post(chatUrl, { chat_id: chat_id });
        
        // এডমিন লিস্ট নিন
        const adminUrl = `https://api.telegram.org/bot${BOT_TOKEN}/getChatAdministrators`;
        let isAdmin = false;
        let adminsCount = 0;
        
        try {
            const adminResponse = await axios.post(adminUrl, { chat_id: chat_id });
            adminsCount = adminResponse.data.result.length;
            isAdmin = adminResponse.data.result.some(admin => admin.user.id === botId);
        } catch (adminError) {
            // এডমিন লিস্ট পাওয়া যায়নি
            console.log('এডমিন লিস্ট পাওয়া যায়নি:', adminError.message);
        }
        
        res.json({ 
            success: true, 
            data: {
                chat_info: chatResponse.data,
                is_bot_admin: isAdmin,
                admins_count: adminsCount,
                bot_id: botId
            }
        });
        
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.response?.data || error.message 
        });
    }
});

// API endpoint: সার্ভার স্ট্যাটাস
app.get('/api/status', async (req, res) => {
    try {
        const botUrl = `https://api.telegram.org/bot${BOT_TOKEN}/getMe`;
        const response = await axios.get(botUrl);
        
        res.json({ 
            success: true,
            server: {
                status: 'running',
                uptime: process.uptime(),
                timestamp: new Date().toISOString()
            },
            bot: {
                ...response.data.result,
                token_set: !!BOT_TOKEN
            }
        });
        
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: 'বট টোকেন ভুল বা নেটওয়ার্ক ত্রুটি' 
        });
    }
});

// মূল রুট
app.get('/', (req, res) => {
    res.json({
        message: 'AddGram Telegram Proxy Server',
        endpoints: {
            health: 'GET /api/health',
            botInfo: 'GET /api/bot-info',
            sendMessage: 'POST /api/send-message',
            broadcast: 'POST /api/broadcast',
            checkBot: 'POST /api/check-bot-status',
            status: 'GET /api/status'
        },
        usage: 'Use these endpoints from your frontend app',
        note: 'This server proxies Telegram API calls to avoid CORS errors'
    });
});

// সার্ভার চালু করুন
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ AddGram Proxy Server running on port ${PORT}`);
    console.log(`🌐 Endpoints:`);
    console.log(`   - GET  /api/health`);
    console.log(`   - GET  /api/bot-info`);
    console.log(`   - POST /api/send-message`);
    console.log(`   - POST /api/broadcast`);
    console.log(`   - POST /api/check-bot-status`);
    console.log(`   - GET  /api/status`);
});
