import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { DatabaseService } from '../database/database.service';

describe('HealthController', () => {
    let controller: HealthController;

    const mockDatabase = {
        isConfigured: jest.fn(),
        ping: jest.fn(),
    };

    beforeEach(async () => {
        jest.clearAllMocks();

        const module: TestingModule = await Test.createTestingModule({
            controllers: [HealthController],
            providers: [{ provide: DatabaseService, useValue: mockDatabase }],
        }).compile();

        controller = module.get(HealthController);
    });

    it('reports the database as "not configured" when DATABASE_URL is unset', async () => {
        mockDatabase.isConfigured.mockReturnValue(false);

        const result = await controller.check();

        expect(result).toEqual({ status: 'ok', database: 'not configured' });
        expect(mockDatabase.ping).not.toHaveBeenCalled();
    });

    it('reports "connected" when configured and reachable', async () => {
        mockDatabase.isConfigured.mockReturnValue(true);
        mockDatabase.ping.mockResolvedValue(true);

        const result = await controller.check();

        expect(result).toEqual({ status: 'ok', database: 'connected' });
    });

    it('reports "unreachable" when configured but the ping fails', async () => {
        mockDatabase.isConfigured.mockReturnValue(true);
        mockDatabase.ping.mockResolvedValue(false);

        const result = await controller.check();

        expect(result).toEqual({ status: 'ok', database: 'unreachable' });
    });
});
