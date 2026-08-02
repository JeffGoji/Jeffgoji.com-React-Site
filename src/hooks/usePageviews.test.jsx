/**
 * @vitest-environment jsdom
 *
 * Environment is pinned per-file so these run before a project-wide Vitest
 * environment is configured.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';

import usePageviews from './usePageviews';
import { trackPageview } from '../lib/analytics';

vi.mock('../lib/analytics', () => ({
    trackPageview: vi.fn(),
}));

/**
 * Stands in for the real route table: mounts the hook once inside the router and
 * exposes navigations as clickable targets, mirroring how App wires PageviewTracker.
 */
function Harness() {
    const navigate = useNavigate();
    usePageviews();

    return (
        <div>
            <button data-testid="to-garage" onClick={() => navigate('/garage')} />
            <button data-testid="to-gallery" onClick={() => navigate('/gallery')} />
        </div>
    );
}

function renderHarness() {
    return render(
        <MemoryRouter initialEntries={['/']}>
            <Harness />
        </MemoryRouter>
    );
}

describe('usePageviews', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        cleanup();
    });

    it('reports one pageview for the entry location', () => {
        renderHarness();

        expect(trackPageview).toHaveBeenCalledTimes(1);
    });

    it('reports exactly one pageview per client-side navigation', () => {
        renderHarness();

        fireEvent.click(screen.getByTestId('to-garage'));
        expect(trackPageview).toHaveBeenCalledTimes(2);

        fireEvent.click(screen.getByTestId('to-gallery'));
        expect(trackPageview).toHaveBeenCalledTimes(3);
    });

    it('does not re-report when navigating to the location already displayed', () => {
        renderHarness();

        fireEvent.click(screen.getByTestId('to-garage'));
        fireEvent.click(screen.getByTestId('to-garage'));

        expect(trackPageview).toHaveBeenCalledTimes(2);
    });

    it('sets no cookies', () => {
        renderHarness();

        fireEvent.click(screen.getByTestId('to-garage'));

        expect(document.cookie).toBe('');
    });
});
