import { BadRequestException, Injectable, InternalServerErrorException, Logger } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { LocationService } from "../location/location.service";
import { CrimeUtils } from "./crime.utils";
import { firstValueFrom } from "rxjs";
import { Crime } from "./interfaces/crime.interface";

interface RawCrimeData {
    id: number;
    category: string;
    location_type: string;
    location: {
        latitude: string;
        longitude: string;
        street: { id: number; name: string };
    };
    context: string;
    outcome_status: { category: string; date: string } | null;
    month: string;
}

@Injectable()
export class CrimeService {
    private readonly logger = new Logger(CrimeService.name);

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
            const { data } = await firstValueFrom(
                this.httpService.get<RawCrimeData[]>(url)
            );

            return data.map((rawItem: RawCrimeData) => this.mapToDomain(rawItem));

        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown error';

            this.logger.error(`Failed to fetch crimes for ${normalized}: ${message}`);
            throw new InternalServerErrorException('An error occurred while retrieving neighborhood crime data.');
        }
    }

    private mapToDomain(raw: RawCrimeData): Crime {
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