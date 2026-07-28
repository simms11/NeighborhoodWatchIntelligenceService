import { render, screen } from '@testing-library/react';
import { TrendComparisonChart } from './TrendComparisonChart';

describe('TrendComparisonChart', () => {
    it('renders nothing when every series is empty', () => {
        const { container } = render(
            <TrendComparisonChart
                series={[
                    { label: 'A', color: '#000', data: [] },
                    { label: 'B', color: '#fff', data: [] },
                ]}
            />,
        );
        expect(container).toBeEmptyDOMElement();
    });

    it('only shows a legend entry for series that actually have data', () => {
        render(
            <TrendComparisonChart
                series={[
                    { label: 'SW1A 2AA', color: '#2563eb', data: [{ month: '2026-05', total: 10 }] },
                    { label: 'E1 6AN', color: '#dc2626', data: [] },
                ]}
            />,
        );

        expect(screen.getByText('SW1A 2AA')).toBeInTheDocument();
        expect(screen.queryByText('E1 6AN')).not.toBeInTheDocument();
    });

    it('labels the heading with the number of months being compared', () => {
        render(
            <TrendComparisonChart
                series={[
                    {
                        label: 'SW1A 2AA',
                        color: '#2563eb',
                        data: [
                            { month: '2026-04', total: 5 },
                            { month: '2026-05', total: 10 },
                        ],
                    },
                ]}
            />,
        );

        expect(screen.getByText('2-Month Trend Comparison')).toBeInTheDocument();
    });
});
