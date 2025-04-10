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
        try {
            const accessToken = await this.getAccessToken();
            const config = {
                method: 'get',
                url: `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(searchitem)}`,
                headers: { 
                    'Authorization': `Bearer ${accessToken}`
                }
            };

            const response = await axios.request(config);
            if (!response.data.messages || response.data.messages.length === 0) {
                console.log("No messages found for search:", searchitem);
                return [];
            }

            console.log(`Found ${response.data.messages.length} messages for search: ${searchitem}`);
            const messages = [];

            for (const msg of response.data.messages) {
                const messageConfig = {
                    method: 'get',
                    url: `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`,
                    headers: { 
                        'Authorization': `Bearer ${accessToken}`
                    }
                };

                try {
                    const messageResponse = await axios.request(messageConfig);
                    const messageData = messageResponse.data;
                    let subject = '';
                    let from = '';
                    let date = '';
                    let body = '';

                    // Get headers
                    if (messageData.payload && messageData.payload.headers) {
                        subject = messageData.payload.headers.find(header => header.name.toLowerCase() === 'subject')?.value || 'No Subject';
                        from = messageData.payload.headers.find(header => header.name.toLowerCase() === 'from')?.value || 'Unknown Sender';
                        date = messageData.payload.headers.find(header => header.name.toLowerCase() === 'date')?.value || '';
                    }

                    // Get body
                    if (messageData.payload) {
                        if (messageData.payload.parts && messageData.payload.parts.length > 0) {
                            // Handle multipart message
                            const textPart = messageData.payload.parts.find(part => part.mimeType === 'text/plain');
                            if (textPart && textPart.body.data) {
                                body = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
                            }
                        } else if (messageData.payload.body && messageData.payload.body.data) {
                            // Handle simple message
                            body = Buffer.from(messageData.payload.body.data, 'base64').toString('utf-8');
                        }
                    }

                    messages.push({
                        id: msg.id,
                        threadId: msg.threadId,
                        subject,
                        from,
                        date,
                        body
                    });

                    // Log each message as we process it
                    console.log('\n-------------------');
                    console.log('Subject:', subject);
                    console.log('From:', from);
                    console.log('Date:', date);
                    console.log('Body:', body);
                    console.log('-------------------\n');

                } catch (error) {
                    console.log(`Error fetching message ${msg.id}:`, error.message);
                }
            }

            return messages;
        } catch (error) {
            console.log('Error searching messages:', error.message);
            return [];
        }
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
        const messages = await this.searchMail(searchitem);
        if (!messages || messages.length === 0) {
            console.log("No messages found");
            return [];
        }

        const results = [];
        for (const message of messages) {
            const config = {
                method: 'get',
                url: `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}`,
                headers: { 
                    'Authorization': `Bearer ${await this.getAccessToken()}`
                }
            };

            try {
                const response = await axios.request(config);
                let encodedMessage = '';
                let subject = '';
                
                // Get subject from headers
                if (response.data.payload && response.data.payload.headers) {
                    const subjectHeader = response.data.payload.headers.find(
                        header => header.name.toLowerCase() === 'subject'
                    );
                    subject = subjectHeader ? subjectHeader.value : 'No Subject';
                }
                
                // Check if message has payload
                if (response.data.payload) {
                    // Handle different message structures
                    if (response.data.payload.parts && response.data.payload.parts.length > 0) {
                        // Multipart message
                        encodedMessage = response.data.payload.parts[0].body.data;
                    } else if (response.data.payload.body && response.data.payload.body.data) {
                        // Simple message
                        encodedMessage = response.data.payload.body.data;
                    }
                    
                    if (encodedMessage) {
                        const decodedMessage = Buffer.from(encodedMessage, 'base64').toString('utf-8');
                        results.push({
                            id: message.id,
                            threadId: message.threadId,
                            subject: subject,
                            body: decodedMessage
                        });
                    }
                }
            } catch (error) {
                console.log(`Error reading message ${message.id}:`, error);
            }
        }

        return results;
    };

    getAllMails = async () => {
        try {
            const accessToken = await this.getAccessToken();
            const config = {
                method: 'get',
                url: 'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=500',
                headers: { 
                    'Authorization': `Bearer ${accessToken}`
                }
            };

            const response = await axios.request(config);
            if (!response.data.messages || response.data.messages.length === 0) {
                console.log("No messages found");
                return [];
            }

            console.log(`Found ${response.data.messages.length} messages`);
            const messages = [];

            for (const msg of response.data.messages) {
                const messageConfig = {
                    method: 'get',
                    url: `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`,
                    headers: { 
                        'Authorization': `Bearer ${accessToken}`
                    }
                };

                try {
                    const messageResponse = await axios.request(messageConfig);
                    const messageData = messageResponse.data;
                    let subject = '';
                    let from = '';
                    let date = '';
                    let body = '';

                    // Get headers
                    if (messageData.payload && messageData.payload.headers) {
                        subject = messageData.payload.headers.find(header => header.name.toLowerCase() === 'subject')?.value || 'No Subject';
                        from = messageData.payload.headers.find(header => header.name.toLowerCase() === 'from')?.value || 'Unknown Sender';
                        date = messageData.payload.headers.find(header => header.name.toLowerCase() === 'date')?.value || '';
                    }

                    // Get body
                    if (messageData.payload) {
                        if (messageData.payload.parts && messageData.payload.parts.length > 0) {
                            // Handle multipart message
                            const textPart = messageData.payload.parts.find(part => part.mimeType === 'text/plain');
                            if (textPart && textPart.body.data) {
                                body = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
                            }
                        } else if (messageData.payload.body && messageData.payload.body.data) {
                            // Handle simple message
                            body = Buffer.from(messageData.payload.body.data, 'base64').toString('utf-8');
                        }
                    }

                    messages.push({
                        id: msg.id,
                        threadId: msg.threadId,
                        subject,
                        from,
                        date,
                        body
                    });

                    // Log each message as we process it
                    console.log('\n-------------------');
                    console.log('Subject:', subject);
                    console.log('From:', from);
                    console.log('Date:', date);
                    console.log('Body:', body);
                    console.log('-------------------\n');

                } catch (error) {
                    console.log(`Error fetching message ${msg.id}:`, error.message);
                }
            }

            return messages;
        } catch (error) {
            console.log('Error fetching messages:', error.message);
            return [];
        }
    };

    readAllMails = async () => {
        const messages = await this.getAllMails();
        if (!messages || messages.length === 0) {
            console.log("No messages found");
            return [];
        }

        const results = [];
        for (const message of messages) {
            const config = {
                method: 'get',
                url: `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}`,
                headers: { 
                    'Authorization': `Bearer ${await this.getAccessToken()}`
                }
            };

            try {
                const response = await axios.request(config);
                let encodedMessage = '';
                let subject = '';
                let from = '';
                let date = '';
                
                // Get email metadata from headers
                if (response.data.payload && response.data.payload.headers) {
                    const subjectHeader = response.data.payload.headers.find(
                        header => header.name.toLowerCase() === 'subject'
                    );
                    const fromHeader = response.data.payload.headers.find(
                        header => header.name.toLowerCase() === 'from'
                    );
                    const dateHeader = response.data.payload.headers.find(
                        header => header.name.toLowerCase() === 'date'
                    );
                    
                    subject = subjectHeader ? subjectHeader.value : 'No Subject';
                    from = fromHeader ? fromHeader.value : 'Unknown Sender';
                    date = dateHeader ? dateHeader.value : 'Unknown Date';
                }
                
                // Check if message has payload
                if (response.data.payload) {
                    // Handle different message structures
                    if (response.data.payload.parts && response.data.payload.parts.length > 0) {
                        // Multipart message
                        encodedMessage = response.data.payload.parts[0].body.data;
                    } else if (response.data.payload.body && response.data.payload.body.data) {
                        // Simple message
                        encodedMessage = response.data.payload.body.data;
                    }
                    
                    if (encodedMessage) {
                        const decodedMessage = Buffer.from(encodedMessage, 'base64').toString('utf-8');
                        results.push({
                            id: message.id,
                            threadId: message.threadId,
                            subject: subject,
                            from: from,
                            date: date,
                            body: decodedMessage
                        });
                    }
                }
            } catch (error) {
                console.log(`Error reading message ${message.id}:`, error);
            }
        }

        return results;
    };
}
module.exports = GmailAPI;
