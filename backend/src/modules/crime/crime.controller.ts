import { Controller, Get, Query } from '@nestjs/common';
import { CrimeService } from './crime.service';
import { Crime } from './interfaces/crime.interface';

@Controller('crimes')
export class CrimeController {
    constructor(private readonly crimeService: CrimeService) {}

    @Get('search')
    async searchCrimes(@Query('postcode') postcode: string): Promise<Crime[]> {
        return this.crimeService.findCrimesByPostcode(postcode);
    }
}