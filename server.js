const express = require('express');
const path = require('path');
const GmailAPI = require('./gmailAPI');

const app = express();
const port = 3000;

// Middleware
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
        const emails = await gmail.searchMail(searchTerm);
        res.json(emails);
    } catch (error) {
        console.error('Error searching emails:', error);
        res.status(500).json({ error: 'Failed to search emails' });
    }
});

// API endpoint to get all emails
app.get('/all-emails', async (req, res) => {
    try {
        const emails = await gmail.getAllMails();
        res.json(emails);
    } catch (error) {
        console.error('Error fetching all emails:', error);
        res.status(500).json({ error: 'Failed to fetch emails' });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
}); 