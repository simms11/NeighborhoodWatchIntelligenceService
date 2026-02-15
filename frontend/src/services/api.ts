import { Crime } from '../../../backend/src/modules/crime/interfaces/crime.interface';

const API_BASE_URL = 'http://localhost:3001';

export const fetchCrimes = async (postcode: string): Promise<Crime[]> => {
    const response = await fetch(`${API_BASE_URL}/crimes/search?postcode=${postcode}`);

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch crime data');
    }

    return response.json();
};