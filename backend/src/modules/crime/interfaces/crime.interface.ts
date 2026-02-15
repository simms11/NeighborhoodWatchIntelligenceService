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