const axios = require('axios');
const GmailAPI = require('./gmailAPI');

// Create an instance of GmailAPI
const gmailAPI = new GmailAPI();


gmailAPI.readMailBody("from:mdsajjat43@gmail.com");
