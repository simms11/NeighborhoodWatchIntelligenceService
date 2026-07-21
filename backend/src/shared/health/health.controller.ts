import { Controller, Get } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { DatabaseService } from '../database/database.service';

@ApiExcludeController()
@Controller('health')
export class HealthController {
    constructor(private readonly database: DatabaseService) {}

    @Get()
    async check() {
        const database = this.database.isConfigured()
            ? ((await this.database.ping()) ? 'connected' : 'unreachable')
            : 'not configured';

        return { status: 'ok', database };
    }
}
