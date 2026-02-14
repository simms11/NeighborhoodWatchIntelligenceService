import {Controller, Get, Query, BadRequestException} from "@nestjs/common";
import {CrimeService} from './crime.service';

@Controller('crimes')
export class CrimeController {
    constructor(
        private readonly crimeService: CrimeService,
    ) {}

    @Get('search')
    async searchCrimes(@Query('postcode') postcode:string){

        if(!postcode) throw new BadRequestException('Postcode is required');

        return this.crimeService.findCrimesByPostcode(postcode);
    }
}
