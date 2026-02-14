import { Injectable, NotFoundException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import {async, firstValueFrom} from 'rxjs';
import { Coordinates } from './interfaces/coordinates.interface';
import {AxiosError} from "axios";

@Injectable()
export class  LocationService{
    constructor(private readonly httpService: HttpService) {
    }

    async getCoordinates(rawPostcode: string): Promise<Coordinates> {
        const normalizedPostcode = rawPostcode.replace(/\s/g, '');

        //UK postcode
        const postcodeRegex = /^[A-Z]{1,2}[0-9][A-Z0-9]? ?[0-9][A-Z]{2}$/;
        if(!postcodeRegex.test(normalizedPostcode)){
            throw new NotFoundException(`Invalid postcode format: ${normalizedPostcode}`);
        }
        try {
            //convert Obserable to a promise
            const {data} = await firstValueFrom(
                this.httpService.get(`https://api.postcodes.io/postcodes/${normalizedPostcode}`)
            );

            if(!data || !data.result){
                throw new NotFoundException('Location not found');
            }

            return {
                lat: data.result.latitude,
                lng: data.result.longitude,
            };

        } catch (error) {

            const axiosError = error as AxiosError;

            if(axiosError.response?.status === 404) {
                throw new NotFoundException(`Postcode '${rawPostcode}' not found.`);
            }
            throw error;
        }
    }
}
