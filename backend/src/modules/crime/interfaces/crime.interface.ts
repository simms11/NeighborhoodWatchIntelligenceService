export interface CrimeLocation {
    latitude: number;
    longitude: number;
    street: {
        id: number;
        name: string;
    };
}

export interface Crime {
    id: number;
    persistent_id?: string;
    category: string;
    location_type: string;
    location: CrimeLocation;
    context: string;
    outcome_status: {
        category: string;
        date: string;
    } | null;
    month:string;
}

export interface MonthlyCrimeCount {
    month: string;
    total: number;
}