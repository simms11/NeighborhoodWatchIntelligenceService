import { Controller, Get, Query } from '@nestjs/common';
import { CrimeService } from './crime.service';

@Controller('crimes')
export class CrimeController {
    constructor(private readonly crimeService: CrimeService) {}

    @Get('search')
    async search(@Query('postcode') postcode: string) {
        return this.crimeService.getCrimesByPostcode(postcode);
    }
}