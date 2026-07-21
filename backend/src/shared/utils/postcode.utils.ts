export class PostcodeUtils {
    private static readonly POSTCODE_REGEX = /^([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})$/i;

    static isValidPostcode(postcode: string): boolean {
        return this.POSTCODE_REGEX.test(postcode.trim());
    }

    /** Normalizes to the canonical "OUTCODE INCODE" format, e.g. "m11ag" -> "M1 1AG". */
    static format(postcode: string): string {
        const match = postcode.trim().match(this.POSTCODE_REGEX);
        if (!match) return postcode.trim().toUpperCase();

        const [, outcode, incode] = match;
        return `${outcode.toUpperCase()} ${incode.toUpperCase()}`;
    }

    /** Space-free uppercase form, useful as a stable cache key. */
    static normalize(postcode: string): string {
        return postcode.replace(/\s+/g, '').toUpperCase();
    }
}
