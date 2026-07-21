import {Module} from '@nestjs/common';
import {ThrottlerModule, ThrottlerGuard} from '@nestjs/throttler';
import {ScheduleModule} from '@nestjs/schedule';
import {APP_GUARD} from '@nestjs/core';
import {CrimeModule} from './modules/crime/crime.module';
import {LocationModule} from './modules/location/location.module';
import {CacheModule} from './shared/cache/cache.module';
import {HealthModule} from './shared/health/health.module';
import {DatabaseModule} from './shared/database/database.module';

@Module({
    imports: [
        // Limit to 10 requests every 1 minute
        ThrottlerModule.forRoot([{
            ttl: 60000,
            limit: 10,
        }]),
        ScheduleModule.forRoot(),
        CacheModule,
        DatabaseModule,
        HealthModule,
        CrimeModule,
        LocationModule,
    ],
    providers: [
        {
            provide: APP_GUARD,
            useClass: ThrottlerGuard,
        },
    ],
})
export class AppModule {
}