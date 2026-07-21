import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import axios from 'axios';

/**
 * Render's free tier spins the service down after ~15 minutes without an
 * inbound HTTP request. Self-pinging our own public URL periodically keeps
 * it warm so a recruiter/reviewer isn't hit with a ~50s cold start.
 *
 * Only runs when RENDER_EXTERNAL_URL is set (Render provides this
 * automatically) — a no-op everywhere else, including local dev.
 */
@Injectable()
export class KeepAliveService {
    private readonly logger = new Logger(KeepAliveService.name);

    @Cron(CronExpression.EVERY_10_MINUTES)
    async ping(): Promise<void> {
        const baseUrl = process.env.RENDER_EXTERNAL_URL;
        if (!baseUrl) return;

        try {
            await axios.get(`${baseUrl}/health`, { timeout: 10_000 });
        } catch (error) {
            this.logger.warn(`Keep-alive ping failed: ${(error as Error).message}`);
        }
    }
}
