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

    getUnreadMails = async () => {
        try {
            const accessToken = await this.getAccessToken();
            const config = {
                method: 'get',
                url: 'https://gmail.googleapis.com/gmail/v1/users/me/messages/?q=is:unread',
                headers: { 
                    'Authorization': `Bearer ${accessToken}`
                }
            };

            const response = await axios.request(config);
            if (!response.data.messages || response.data.messages.length === 0) {
                console.log("No unread messages found");
                return [];
            }

            console.log(`Found ${response.data.messages.length} unread messages`);
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
                        body,
                        unread: true
                    });

                    // Log each message as we process it
                    console.log('\n-------------------');
                    console.log('Subject:', subject);
                    console.log('From:', from);
                    console.log('Date:', date);
                    console.log('-------------------\n');

                } catch (error) {
                    console.log(`Error fetching message ${msg.id}:`, error.message);
                }
            }

            return messages;
        } catch (error) {
            console.log('Error fetching unread messages:', error.message);
            return [];
        }
    };

    getEmailsWithAttachments = async () => {
        try {
            const accessToken = await this.getAccessToken();
            const config = {
                method: 'get',
                url: 'https://gmail.googleapis.com/gmail/v1/users/me/messages?q=has:attachment',
                headers: { 
                    'Authorization': `Bearer ${accessToken}`
                }
            };

            const response = await axios.request(config);
            if (!response.data.messages || response.data.messages.length === 0) {
                console.log("No messages with attachments found");
                return [];
            }

            console.log(`Found ${response.data.messages.length} messages with attachments`);
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
                    let attachments = [];

                    // Get headers
                    if (messageData.payload && messageData.payload.headers) {
                        subject = messageData.payload.headers.find(header => header.name.toLowerCase() === 'subject')?.value || 'No Subject';
                        from = messageData.payload.headers.find(header => header.name.toLowerCase() === 'from')?.value || 'Unknown Sender';
                        date = messageData.payload.headers.find(header => header.name.toLowerCase() === 'date')?.value || '';
                    }

                    // Get body and attachments
                    if (messageData.payload) {
                        // Function to process parts recursively
                        const processParts = (part) => {
                            if (part.mimeType === 'text/plain' && part.body.data) {
                                body = Buffer.from(part.body.data, 'base64').toString('utf-8');
                            } else if (part.mimeType && part.mimeType.includes('application/') && part.body.attachmentId) {
                                attachments.push({
                                    id: part.body.attachmentId,
                                    filename: part.filename,
                                    mimeType: part.mimeType,
                                    size: part.body.size
                                });
                            }
                            
                            // Process nested parts
                            if (part.parts) {
                                part.parts.forEach(processParts);
                            }
                        };

                        if (messageData.payload.parts) {
                            messageData.payload.parts.forEach(processParts);
                        } else if (messageData.payload.body && messageData.payload.body.data) {
                            body = Buffer.from(messageData.payload.body.data, 'base64').toString('utf-8');
                        }
                    }

                    messages.push({
                        id: msg.id,
                        threadId: msg.threadId,
                        subject,
                        from,
                        date,
                        body,
                        attachments,
                        hasAttachments: attachments.length > 0
                    });

                } catch (error) {
                    console.log(`Error fetching message ${msg.id}:`, error.message);
                }
            }

            return messages;
        } catch (error) {
            console.log('Error fetching messages with attachments:', error.message);
            return [];
        }
    };

    async getDraftMails() {
        try {
            console.log('Starting to fetch draft emails...');
            const accessToken = await this.getAccessToken();
            
            if (!accessToken) {
                console.error('Failed to get access token');
                throw new Error('Access token not available');
            }
            
            console.log('Access token obtained, fetching drafts list...');

            const config = {
                method: 'get',
                url: 'https://gmail.googleapis.com/gmail/v1/users/me/drafts',
                headers: { 
                    'Authorization': `Bearer ${accessToken}`,
                    'Accept': 'application/json'
                }
            };

            console.log('Making request to Gmail API for drafts...');
            const response = await axios.request(config);
            
            console.log('Raw API Response:', JSON.stringify(response.data, null, 2));

            if (!response.data) {
                console.error('No data received from Gmail API');
                return [];
            }

            if (!response.data.drafts || response.data.drafts.length === 0) {
                console.log("No draft messages found");
                return [];
            }

            console.log(`Found ${response.data.drafts.length} drafts, fetching details...`);

            // Fetch full details for each draft
            const draftPromises = response.data.drafts.map(async (draft) => {
                console.log(`Fetching details for draft ID: ${draft.id}`);
                const draftConfig = {
                    method: 'get',
                    url: `https://gmail.googleapis.com/gmail/v1/users/me/drafts/${draft.id}`,
                    headers: { 
                        'Authorization': `Bearer ${accessToken}`,
                        'Accept': 'application/json'
                    }
                };

                try {
                    const draftResponse = await axios.request(draftConfig);
                    console.log(`Received draft details for ID ${draft.id}`);
                    
                    if (!draftResponse.data || !draftResponse.data.message) {
                        console.warn(`Invalid draft data received for ID ${draft.id}`);
                        return null;
                    }

                    const message = draftResponse.data.message;

                    // Extract headers
                    const headers = {};
                    if (message.payload && message.payload.headers) {
                        message.payload.headers.forEach(header => {
                            headers[header.name.toLowerCase()] = header.value;
                        });
                    } else {
                        console.warn(`No headers found in draft ${draft.id}`);
                    }

                    // Extract body
                    let body = '';
                    if (message.payload) {
                        if (message.payload.parts) {
                            const textPart = message.payload.parts.find(part => part.mimeType === 'text/plain');
                            if (textPart && textPart.body && textPart.body.data) {
                                body = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
                                console.log(`Found text body in draft ${draft.id}`);
                            } else {
                                console.log(`No text body found in multipart draft ${draft.id}`);
                            }
                        } else if (message.payload.body && message.payload.body.data) {
                            body = Buffer.from(message.payload.body.data, 'base64').toString('utf-8');
                            console.log(`Found simple body in draft ${draft.id}`);
                        } else {
                            console.log(`No body data found in draft ${draft.id}`);
                        }
                    } else {
                        console.warn(`No payload found in draft ${draft.id}`);
                    }

                    const draftData = {
                        id: draft.id,
                        subject: headers.subject || 'No Subject',
                        from: headers.from || 'No Sender',
                        to: headers.to || 'No Recipient',
                        date: headers.date || 'No Date',
                        body: body || 'No Content',
                        isDraft: true
                    };

                    console.log('Processed draft data:', {
                        id: draftData.id,
                        subject: draftData.subject,
                        from: draftData.from,
                        hasBody: !!draftData.body
                    });

                    return draftData;
                } catch (error) {
                    console.error(`Error fetching draft ${draft.id}:`, error.message);
                    if (error.response) {
                        console.error('Error response:', {
                            status: error.response.status,
                            data: error.response.data
                        });
                    }
                    return null;
                }
            });

            const drafts = (await Promise.all(draftPromises)).filter(draft => draft !== null);
            console.log(`Successfully processed ${drafts.length} drafts`);
            
            if (drafts.length === 0) {
                console.log('No drafts were successfully processed');
            } else {
                console.log('Draft IDs processed:', drafts.map(d => d.id).join(', '));
            }

            return drafts;

        } catch (error) {
            console.error('Error in getDraftMails:', error.message);
            if (error.response) {
                console.error('Error response:', {
                    status: error.response.status,
                    data: error.response.data
                });
            }
            throw error;
        }
    }

    async getImportantMails() {
        try {
            const accessToken = await this.getAccessToken();
            console.log('Fetching important emails...');

            const config = {
                method: 'get',
                url: 'https://gmail.googleapis.com/gmail/v1/users/me/messages?q=is:important',
                headers: { 
                    'Authorization': `Bearer ${accessToken}`
                }
            };

            const response = await axios.request(config);
            if (!response.data.messages || response.data.messages.length === 0) {
                console.log("No important messages found");
                return [];
            }

            console.log(`Found ${response.data.messages.length} important messages`);

            // Fetch full details for each message
            const messagePromises = response.data.messages.map(async (message) => {
                const messageConfig = {
                    method: 'get',
                    url: `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}`,
                    headers: { 
                        'Authorization': `Bearer ${accessToken}`
                    }
                };

                try {
                    const messageResponse = await axios.request(messageConfig);
                    const messageData = messageResponse.data;
                    const headers = {};
                    messageData.payload.headers.forEach(header => {
                        headers[header.name.toLowerCase()] = header.value;
                    });

                    // Extract body
                    let body = '';
                    if (messageData.payload.parts) {
                        const textPart = messageData.payload.parts.find(part => part.mimeType === 'text/plain');
                        if (textPart && textPart.body && textPart.body.data) {
                            body = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
                        }
                    } else if (messageData.payload.body && messageData.payload.body.data) {
                        body = Buffer.from(messageData.payload.body.data, 'base64').toString('utf-8');
                    }

                    return {
                        id: message.id,
                        subject: headers.subject || 'No Subject',
                        from: headers.from || 'No Sender',
                        to: headers.to || 'No Recipient',
                        date: headers.date || 'No Date',
                        body: body || 'No Content',
                        isImportant: true
                    };
                } catch (error) {
                    console.warn(`Failed to fetch message ${message.id}:`, error.message);
                    return null;
                }
            });

            const messages = (await Promise.all(messagePromises)).filter(message => message !== null);
            console.log(`Successfully processed ${messages.length} important messages`);
            return messages;

        } catch (error) {
            console.error('Error fetching important messages:', error);
            throw error;
        }
    }
}
module.exports = GmailAPI;
