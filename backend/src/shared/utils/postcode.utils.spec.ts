import { PostcodeUtils } from './postcode.utils';

describe('PostcodeUtils', () => {
    describe('isValidPostcode', () => {
        it.each(['SW1A 2AA', 'sw1a2aa', 'M1 1AG', 'EC1A1BB', 'W1A 0AX'])(
            'accepts %s as a valid UK postcode',
            (postcode) => {
                expect(PostcodeUtils.isValidPostcode(postcode)).toBe(true);
            },
        );

        it.each(['Manchester', 'London', '12345', ''])(
            'rejects %s as not a UK postcode',
            (value) => {
                expect(PostcodeUtils.isValidPostcode(value)).toBe(false);
            },
        );
    });

    describe('format', () => {
        it('inserts a space before the incode and uppercases the result', () => {
            expect(PostcodeUtils.format('sw1a2aa')).toBe('SW1A 2AA');
        });

        it('is idempotent on an already-formatted postcode', () => {
            expect(PostcodeUtils.format('SW1A 2AA')).toBe('SW1A 2AA');
        });
    });

    describe('normalize', () => {
        it('strips whitespace and uppercases', () => {
            expect(PostcodeUtils.normalize('sw1a 2aa')).toBe('SW1A2AA');
        });
    });
});
