import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { CrimeController } from './crime.controller';
import { CrimeService } from './crime.service';
import { LocationModule } from '../location/location.module';

@Module({
    imports: [
        HttpModule,
        LocationModule
    ],
    controllers: [CrimeController],
    providers: [CrimeService],
})
export class CrimeModule {}