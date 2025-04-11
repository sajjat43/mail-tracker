const express = require('express');
const path = require('path');
const GmailAPI = require('./gmailAPI');
const cors = require('cors');

const app = express();
const port = 3000;

// CORS configuration
const corsOptions = {
    origin: '*', // Allow all origins
    methods: ['GET', 'POST'], // Allow both GET and POST methods
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const gmail = new GmailAPI();

// Serve the frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// API endpoint to search emails
app.post('/search-emails', async (req, res) => {
    try {
        const { searchTerm } = req.body;
        if (!searchTerm) {
            return res.status(400).json({ error: 'Search term is required' });
        }
        console.log('Searching emails with term:', searchTerm);
        
        const emails = await gmail.searchMail(searchTerm);
        console.log(`Found ${emails.length} emails for search term: ${searchTerm}`);
        res.json(emails);
    } catch (error) {
        console.error('Error in /search-emails:', error);
        res.status(500).json({ 
            error: 'Failed to search emails',
            details: error.message 
        });
    }
});

// API endpoint to get all emails
app.get('/all-emails', async (req, res) => {
    try {
        console.log('Fetching all emails');
        const emails = await gmail.getAllMails();
        console.log(`Found ${emails.length} total emails`);
        res.json(emails);
    } catch (error) {
        console.error('Error in /all-emails:', error);
        res.status(500).json({ 
            error: 'Failed to fetch all emails',
            details: error.message 
        });
    }
});

// API endpoint to get unread emails
app.get('/unread-emails', async (req, res) => {
    try {
        console.log('Fetching unread emails');
        const emails = await gmail.getUnreadMails();
        console.log(`Found ${emails.length} unread emails`);
        res.json(emails);
    } catch (error) {
        console.error('Error in /unread-emails:', error);
        res.status(500).json({ 
            error: 'Failed to fetch unread emails',
            details: error.message 
        });
    }
});

// API endpoint to get emails with attachments
app.get('/attachment-emails', async (req, res) => {
    try {
        console.log('Fetching emails with attachments');
        const emails = await gmail.getEmailsWithAttachments();
        console.log(`Found ${emails.length} emails with attachments`);
        res.json(emails);
    } catch (error) {
        console.error('Error fetching emails with attachments:', error);
        res.status(500).json({ 
            error: 'Failed to fetch emails with attachments',
            details: error.message 
        });
    }
});

// API endpoint to get draft emails
app.get('/draft-emails', async (req, res) => {
    console.log('Received request for draft emails');
    try {
        console.log('Calling Gmail API to fetch drafts...');
        const drafts = await gmail.getDraftMails();
        
        // Ensure we always return an array
        const response = Array.isArray(drafts) ? drafts : [];
        
        console.log(`Sending ${response.length} drafts to client`);
        res.json(response);
    } catch (error) {
        console.error('Error in /draft-emails endpoint:', error);
        res.status(500).json({ 
            error: 'Failed to fetch draft emails',
            details: error.message
        });
    }
});

// API endpoint to get important emails
app.get('/important-emails', async (req, res) => {
    console.log('Received request for important emails');
    try {
        console.log('Calling Gmail API to fetch important emails...');
        const importantEmails = await gmail.getImportantMails();
        
        // Ensure we always return an array
        const response = Array.isArray(importantEmails) ? importantEmails : [];
        
        console.log(`Sending ${response.length} important emails to client`);
        res.json(response);
    } catch (error) {
        console.error('Error in /important-emails endpoint:', error);
        res.status(500).json({ 
            error: 'Failed to fetch important emails',
            details: error.message
        });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Global error handler:', err);
    res.status(500).json({ 
        error: 'Internal server error',
        details: err.message 
    });
});

// Improved error handling for server startup
const server = app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
}).on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`Port ${port} is already in use. Please try a different port or stop the existing server.`);
    } else {
        console.error('Failed to start server:', error);
    }
    process.exit(1);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
    console.log('Received SIGTERM. Performing graceful shutdown...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('Received SIGINT. Performing graceful shutdown...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
}); 