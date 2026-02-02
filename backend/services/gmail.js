
import { google } from 'googleapis';

class GmailService {
    constructor(pool) {
        this.pool = pool;
        this.oauth2Client = null;
    }

    async initialize() {
        const access_token = await this.getConfig('gmail_access_token');
        const refresh_token = await this.getConfig('gmail_refresh_token');
        const client_id = await this.getConfig('gmail_client_id');
        const client_secret = await this.getConfig('gmail_client_secret');

        if (client_id && client_secret) {
            this.oauth2Client = new google.auth.OAuth2(
                client_id,
                client_secret,
                'postmessage' // Or your redirect URI
            );

            if (access_token && refresh_token) {
                this.oauth2Client.setCredentials({
                    access_token,
                    refresh_token
                });
            }
        }
    }

    async getConfig(key) {
        const res = await this.pool.query('SELECT value FROM system_config WHERE key = $1', [key]);
        return res.rows[0]?.value;
    }

    async setConfig(key, value) {
        await this.pool.query(
            'INSERT INTO system_config (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()',
            [key, value]
        );
    }

    async generateAuthUrl(clientId, clientSecret) {
        // Save client config first
        await this.setConfig('gmail_client_id', clientId);
        await this.setConfig('gmail_client_secret', clientSecret);

        // Use proper redirect URI that matches Google Cloud Console
        const redirectUri = 'http://localhost:5173/api/settings/email/callback';

        this.oauth2Client = new google.auth.OAuth2(
            clientId,
            clientSecret,
            redirectUri
        );

        const scopes = [
            'https://www.googleapis.com/auth/gmail.readonly',
            'https://www.googleapis.com/auth/gmail.modify'
        ];

        return this.oauth2Client.generateAuthUrl({
            access_type: 'offline', // Important for refresh token
            scope: scopes,
            prompt: 'consent', // Force refresh token
            include_granted_scopes: true
        });
    }

    async authenticate(code) {
        if (!this.oauth2Client) throw new Error('OAuth client not initialized');

        const { tokens } = await this.oauth2Client.getToken(code);
        this.oauth2Client.setCredentials(tokens);

        if (tokens.access_token) await this.setConfig('gmail_access_token', tokens.access_token);
        if (tokens.refresh_token) await this.setConfig('gmail_refresh_token', tokens.refresh_token); // Important!

        return true;
    }

    async checkEmails() {
        if (!this.oauth2Client) await this.initialize();
        if (!this.oauth2Client) throw new Error('Gmail not configured');

        const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
        const labelName = await this.getConfig('gmail_label') || 'CSV-Imports';

        // 1. Get Label ID (optional, or just search by label name directly in q)
        // using query 'label:NAME is:unread has:attachment'
        const q = `label:${labelName} is:unread has:attachment`;

        const res = await gmail.users.messages.list({
            userId: 'me',
            q: q
        });

        const messages = res.data.messages || [];
        const attachments = [];

        for (const msg of messages) {
            const msgDetails = await gmail.users.messages.get({
                userId: 'me',
                id: msg.id
            });

            const parts = msgDetails.data.payload.parts || [];

            for (const part of parts) {
                if (part.filename && part.filename.endsWith('.csv') && part.body.attachmentId) {
                    const attachment = await gmail.users.messages.attachments.get({
                        userId: 'me',
                        messageId: msg.id,
                        id: part.body.attachmentId
                    });

                    const buffer = Buffer.from(attachment.data.data, 'base64');
                    const csvContent = buffer.toString('utf-8');

                    attachments.push({
                        filename: part.filename,
                        content: csvContent,
                        messageId: msg.id
                    });
                }
            }
        }

        return attachments;
    }

    async markAsRead(messageIds) {
        if (!this.oauth2Client) return;
        const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });

        await gmail.users.messages.batchModify({
            userId: 'me',
            requestBody: {
                ids: messageIds,
                removeLabelIds: ['UNREAD']
            }
        });
    }
}

export default GmailService;
