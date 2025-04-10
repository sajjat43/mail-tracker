const express = require('express');
const path = require('path');
const GmailAPI = require('./gmailAPI');
const cors = require('cors');

const app = express();
const port = 3000;

// Middleware
app.use(cors());
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

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Global error handler:', err);
    res.status(500).json({ 
        error: 'Internal server error',
        details: err.message 
    });
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
}); 