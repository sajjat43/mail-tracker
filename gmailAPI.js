const axios = require('axios');
require('dotenv').config();

class GmailAPI {
    getAccessToken = async (searchitem) => {
        const params = new URLSearchParams({
            client_id: process.env.GMAIL_CLIENT_ID,
            client_secret: process.env.GMAIL_CLIENT_SECRET,
            refresh_token: process.env.GMAIL_REFRESH_TOKEN,
            grant_type: "refresh_token"
        });
        
        let config = {
            method: 'post',
            maxBodyLength: Infinity,
            url: 'https://oauth2.googleapis.com/token',
            headers: { 
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            data: params
        };
        
        var accessToken = '';
        
        await axios.request(config)
        .then(async function(response) {
            
          accessToken = await response.data.access_token;
          console.log("accessToken: " + accessToken);
        })
        .catch((error) => {
          console.log(error);
        });
        
            return accessToken;
    };
    searchMail = async (searchitem) => {
        const config1 = {
            method: 'get',
            url: 'https://gmail.googleapis.com/gmail/v1/users/me/messages?q=' + searchitem,
            headers: { 
                'Authorization': `Bearer ${await this.getAccessToken()}`
            }
        };
        let responseId = '';
        let threadId = '';
        await axios.request(config1)
            .then(async function(response){
                if (response.data.messages && response.data.messages.length > 0) {
                    responseId = response.data.messages[0].id;
                    threadId = response.data.messages[0].threadId;
                    console.log("ID: " + responseId, "Thread ID: " + threadId);
                }
            })
            .catch((error) => {
                console.log(error);
            });
        return responseId;
    };
    readMail = async (threadId) => {
        const config2 = {
            method: 'get',
            url: 'https://gmail.googleapis.com/gmail/v1/users/me/messages/' + threadId,
            headers: {
                'Authorization': `Bearer ${await this.getAccessToken()}`    
            }
        };
        let response = '';
        await axios.request(config2)
            .then(async function(response){
                response = await response.data; 
                console.log(response);
            })
            .catch((error) => {
                console.log(error);
            });
        return response;
    };

    readMailBody = async (searchitem) => {
        const messageId = await this.searchMail(searchitem);
        if (!messageId) {
            console.log("No messages found");
            return;
        }

        const config = {
            method: 'get',
            url: `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}`,
            headers: { 
                'Authorization': `Bearer ${await this.getAccessToken()}`
            }
        };

        try {
            const message = await axios.request(config);
            let encodedMessage = '';
            let subject = '';
            
            // Get subject from headers
            if (message.data.payload && message.data.payload.headers) {
                const subjectHeader = message.data.payload.headers.find(
                    header => header.name.toLowerCase() === 'subject'
                );
                subject = subjectHeader ? subjectHeader.value : 'No Subject';
                console.log("Subject:", subject);
            }
            
            // Check if message has payload
            if (message.data.payload) {
                // Handle different message structures
                if (message.data.payload.parts && message.data.payload.parts.length > 0) {
                    // Multipart message
                    encodedMessage = message.data.payload.parts[0].body.data;
                } else if (message.data.payload.body && message.data.payload.body.data) {
                    // Simple message
                    encodedMessage = message.data.payload.body.data;
                }
                
                if (encodedMessage) {
                    const decodedMessage = Buffer.from(encodedMessage, 'base64').toString('utf-8');
                    console.log("Boday:", decodedMessage);
                    return {
                        subject: subject,
                        body: decodedMessage
                    };
                }
            }
            console.log("Could not find message body");
            return { subject: subject, body: null };
            
        } catch (error) {
            console.log("Error reading message:", error);
            return { subject: null, body: null };
        }
    };
}
module.exports = GmailAPI;
