import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CrimeService } from './crime.service';

@ApiTags('crimes')
@Controller('crimes')
export class CrimeController {
    constructor(private readonly crimeService: CrimeService) {}

    @Get('search')
    @ApiOperation({ summary: 'Search street-level crime incidents near a UK postcode or place name' })
    @ApiQuery({ name: 'postcode', example: 'SW1A 2AA', description: 'UK postcode or a city/town name' })
    @ApiResponse({ status: 200, description: 'Crime incidents for the most recently available month' })
    @ApiResponse({ status: 404, description: 'The postcode or place name could not be located' })
    async search(@Query('postcode') postcode: string) {
        return this.crimeService.getCrimesByPostcode(postcode);
    }

    @Get('trend')
    @ApiOperation({ summary: 'Month-by-month incident counts for the last N months near a location' })
    @ApiQuery({ name: 'postcode', example: 'SW1A 2AA', description: 'UK postcode or a city/town name' })
    @ApiQuery({ name: 'months', required: false, example: 6, description: 'Number of months to include (default 6)' })
    @ApiResponse({ status: 200, description: 'Array of { month, total } incident counts, oldest first' })
    @ApiResponse({ status: 404, description: 'The postcode or place name could not be located' })
    async trend(@Query('postcode') postcode: string, @Query('months') months?: string) {
        const parsedMonths = months ? parseInt(months, 10) : undefined;
        return this.crimeService.getTrendByPostcode(postcode, parsedMonths);
    }
}
