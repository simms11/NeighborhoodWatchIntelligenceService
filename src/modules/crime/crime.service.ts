import { BadRequestException, Injectable, InternalServerErrorException } from "@nestjs/common";
import { HttpService } from "@nestjs/axios"; // <--- IMPORT THIS
import { LocationService } from "../location/location.service";
import { CrimeUtils } from "./crime.utils";
import { firstValueFrom } from "rxjs";
import { Crime } from "./interfaces/crime.interface";

@Injectable()
export class CrimeService {
    constructor(
        private readonly locationService: LocationService,
        private readonly httpService: HttpService
    ) {}

    async findCrimesByPostcode(postcode: string): Promise<Crime[]> {
        const normalized = CrimeUtils.normalizePostcode(postcode);

        if (!CrimeUtils.isValidPostcode(normalized)) {
            throw new BadRequestException(`Invalid postcode format: ${postcode}`);
        }

        const { lat, lng } = await this.locationService.getCoordinates(normalized);

        const url = `https://data.police.uk/api/crimes-street/all-crime?lat=${lat}&lng=${lng}`;

        try {
            const { data } = await firstValueFrom(this.httpService.get(url));

            return data.map((item: any) => this.mapToDomain(item));

        } catch (error) {
            console.error(`Failed to fetch crimes for ${normalized}`, error.message);

            throw new InternalServerErrorException('Could not fetch crime data');
        }
    }

    private mapToDomain(raw: any): Crime {
        return {
            id: raw.id,
            category: raw.category,
            location_type: raw.location_type,
            location: {
                latitude: parseFloat(raw.location.latitude),
                longitude: parseFloat(raw.location.longitude),
                street: {
                    id: raw.location.street.id,
                    name: raw.location.street.name,
                },
            },
            context: raw.context,
            outcome_status: raw.outcome_status ? {
                category: raw.outcome_status.category,
                date: raw.outcome_status.date,
            } : null,
            month: raw.month,
        };
    }
}