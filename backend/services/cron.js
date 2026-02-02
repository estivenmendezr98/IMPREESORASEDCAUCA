
import cron from 'node-cron';
import GmailService from './gmail.js';
import { startImport } from './importLogic.js';

class CronService {
    constructor(pool) {
        this.pool = pool;
        this.gmailService = new GmailService(pool);
        this.task = null;
        this.isRunning = false;
    }

    start() {
        console.log('🔄 Initializing cron service...');
        // Schedule task (every 10 minutes)
        this.task = cron.schedule('*/10 * * * *', async () => {
            if (this.isRunning) return;
            this.isRunning = true;
            console.log('⏰ Auto-import check started...');

            try {
                const isActive = await this.gmailService.getConfig('is_active');
                if (isActive !== 'true') {
                    this.isRunning = false;
                    return;
                }

                const attachments = await this.gmailService.checkEmails();
                console.log(`📧 Found ${attachments.length} CSVs`);

                if (attachments.length > 0) {
                    const processedIds = [];

                    for (const att of attachments) {
                        console.log(`Processing auto-import: ${att.filename}`);

                        try {
                            await startImport(
                                this.pool,
                                `[Auto] ${att.filename}`,
                                att.content,
                                null, // Use current date/auto detect
                                null // No file path to clean
                            );
                            processedIds.push(att.messageId);
                        } catch (err) {
                            console.error(`Error importing ${att.filename}:`, err);
                        }
                    }

                    if (processedIds.length > 0) {
                        await this.gmailService.markAsRead(processedIds);
                    }
                }
            } catch (err) {
                console.error('Error in auto-import task:', err);
            } finally {
                this.isRunning = false;
            }
        });

        console.log('✅ Cron task scheduled (runs every 10 min if active).');
    }
}

export default CronService;
