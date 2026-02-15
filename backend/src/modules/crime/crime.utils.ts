export class CrimeUtils {

    static normalizePostcode(postcode: string): string {
        if (!postcode) return '';
        return postcode.replace(/\s+/g, '').toUpperCase();
    }

    static isValidPostcode(postcode: string): boolean {
        const regex = /^[A-Z]{1,2}[0-9][A-Z0-9]? ?[0-9][A-Z]{2}$/;
        return regex.test(postcode);
    }
}