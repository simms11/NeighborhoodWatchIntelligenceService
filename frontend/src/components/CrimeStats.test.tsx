import { render, screen } from '@testing-library/react';
import { CrimeStats } from './CrimeStats';
import { Crime } from '@neighborhood-watch/shared-types';

const buildCrime = (category: string, outcome: Crime['outcome_status'] = null): Crime => ({
    id: Math.random(),
    category,
    location_type: 'Force',
    location: { latitude: 51.5, longitude: -0.1, street: { id: 1, name: 'On or near Test Street' } },
    context: '',
    outcome_status: outcome,
    month: '2026-05',
});

describe('CrimeStats', () => {
    it('renders nothing when there are no crimes', () => {
        const { container } = render(<CrimeStats crimes={[]} />);
        expect(container).toBeEmptyDOMElement();
    });

    it('shows the total incident count and the most frequent categories first', () => {
        const crimes = [
            ...Array(3).fill(null).map(() => buildCrime('burglary')),
            ...Array(1).fill(null).map(() => buildCrime('shoplifting')),
        ];

        render(<CrimeStats crimes={crimes} />);

        expect(screen.getByText('Total incidents: 4')).toBeInTheDocument();
        const categoryLabels = screen.getAllByText(/burglary|shoplifting/i);
        expect(categoryLabels[0]).toHaveTextContent(/burglary/i);
    });

    it('computes the resolved-outcomes percentage from crimes that have an outcome_status', () => {
        const crimes = [
            buildCrime('burglary', { category: 'Under investigation', date: '' }),
            buildCrime('burglary', { category: 'Under investigation', date: '' }),
            buildCrime('burglary', null),
            buildCrime('burglary', null),
        ];

        render(<CrimeStats crimes={crimes} />);

        expect(screen.getByText('50%')).toBeInTheDocument();
    });
});
