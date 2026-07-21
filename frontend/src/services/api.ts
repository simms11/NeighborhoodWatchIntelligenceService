import { Crime } from '../../../backend/src/modules/crime/interfaces/crime.interface';
import { MonthlyCrimeCount } from '../../../backend/src/modules/crime/crime.service';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';

export const fetchCrimes = async (postcode: string): Promise<Crime[]> => {
    const response = await fetch(`${API_BASE_URL}/crimes/search?postcode=${encodeURIComponent(postcode)}`);

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch crime data');
    }

    return response.json();
};

export const fetchTrend = async (postcode: string, months = 12): Promise<MonthlyCrimeCount[]> => {
    const response = await fetch(
        `${API_BASE_URL}/crimes/trend?postcode=${encodeURIComponent(postcode)}&months=${months}`,
    );

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch crime trend');
    }

    return response.json();
};
