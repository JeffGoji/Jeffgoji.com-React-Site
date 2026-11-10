/**
 * @vitest-environment jsdom
 *
 * Covers the November 2026 What's New redesign: the dated recent-updates
 * timeline. The archived V2 launch page has its own suite in V2Launch.test.jsx;
 * that every timeline link resolves to a served route is asserted at App level
 * in src/App.test.jsx.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import WhatsNew, { formatDate, groupByMonth } from './index';
import { recentUpdates } from './data/recentUpdates';

afterEach(cleanup);

const renderPage = (props) =>
    render(
        <MemoryRouter>
            <WhatsNew {...props} />
        </MemoryRouter>
    );

const FIXTURE = [
    {
        date: '2026-06-02',
        category: 'Fixes',
        title: 'Older fix',
        summary: 'A fix.',
        links: [{ label: 'Fix link', to: '/galleries' }],
    },
    {
        date: '2026-08-10',
        category: 'Videos',
        title: 'Newest video',
        summary: 'Video hub.',
        links: [{ label: 'Watch', to: '/youtube' }],
    },
    {
        date: '2026-08-01',
        category: 'Galleries',
        title: 'August gallery',
        summary: '<img src=x onerror=alert(1)>',
        links: [
            { label: 'Open', to: '/galleries?set=nb-autox' },
            { label: 'Also', to: '/garage' },
        ],
    },
];

describe('the page shell', () => {
    it('mounts one main with the dashboard band inside it', () => {
        const { container } = renderPage();

        expect(screen.getAllByRole('main')).toHaveLength(1);
        expect(container.querySelector('main > header.wn-dash')).not.toBeNull();
        expect(screen.getByRole('heading', { level: 1 })).not.toBeNull();
    });

    it('names the covered date range from the data', () => {
        const { container } = renderPage({ updates: FIXTURE });

        expect(container.querySelector('.wn-dash .eyebrow').textContent).toMatch(
            /June 2026 – August 2026/
        );
    });

    it('links to the archived V2 launch ledger', () => {
        renderPage();

        expect(
            screen.getByRole('link', { name: /original launch ledger/i }).getAttribute('href')
        ).toBe('/whats-new/v2-launch');
    });
});

describe('the latest card', () => {
    it('features the newest update regardless of authored order', () => {
        const { container } = renderPage({ updates: FIXTURE });

        const latest = container.querySelector('.ru-latest');
        expect(latest.textContent).toContain('Newest video');
        expect(within(latest).getByRole('link', { name: 'Watch' }).getAttribute('href')).toBe(
            '/youtube'
        );
    });
});

describe('the timeline', () => {
    it('renders one card per update, newest first', () => {
        const { container } = renderPage({ updates: FIXTURE });

        const titles = [...container.querySelectorAll('.ru-card__title')].map((h) => h.textContent);
        expect(titles).toEqual(['Newest video', 'August gallery', 'Older fix']);
    });

    it('groups cards under month headings', () => {
        const { container } = renderPage({ updates: FIXTURE });

        const months = [...container.querySelectorAll('.ru-month__title')].map((h) => h.textContent);
        expect(months).toEqual(['August 2026', 'June 2026']);
    });

    it('renders every link of every update as a direct link', () => {
        const { container } = renderPage({ updates: FIXTURE });

        const hrefs = [...container.querySelectorAll('.ru-list a')].map((a) => a.getAttribute('href'));
        expect(hrefs).toEqual(['/youtube', '/galleries?set=nb-autox', '/garage', '/galleries']);
    });

    it('carries a machine-readable date on each card', () => {
        const { container } = renderPage({ updates: FIXTURE });

        expect(container.querySelector('.ru-list time').getAttribute('datetime')).toBe('2026-08-10');
    });

    it('renders entry text as text, never as HTML', () => {
        const { container } = renderPage({ updates: FIXTURE });

        expect(container.querySelector('.ru-list img')).toBeNull();
        expect(container.textContent).toContain('<img src=x onerror=alert(1)>');
    });

    it('renders the full content module', () => {
        const { container } = renderPage();

        expect(container.querySelectorAll('.ru-list .ru-item')).toHaveLength(recentUpdates.length);
    });

    it('shows an empty state when there is nothing to show', () => {
        const { container } = renderPage({ updates: [] });

        expect(container.querySelector('.ru-latest')).toBeNull();
        expect(container.querySelector('.ru-empty')).not.toBeNull();
    });
});

describe('the category filters', () => {
    it('offers All plus only the categories that have updates', () => {
        renderPage({ updates: FIXTURE });

        const group = screen.getByRole('group', { name: /filter updates/i });
        const labels = within(group).getAllByRole('button').map((b) => b.textContent);
        expect(labels).toEqual(['All', 'Galleries', 'Videos', 'Fixes']);
    });

    it('narrows the timeline to one category and back', () => {
        const { container } = renderPage({ updates: FIXTURE });
        const group = screen.getByRole('group', { name: /filter updates/i });

        fireEvent.click(within(group).getByRole('button', { name: 'Fixes' }));
        expect([...container.querySelectorAll('.ru-card__title')].map((h) => h.textContent)).toEqual([
            'Older fix',
        ]);
        expect(within(group).getByRole('button', { name: 'Fixes' }).getAttribute('aria-pressed')).toBe(
            'true'
        );

        fireEvent.click(within(group).getByRole('button', { name: 'All' }));
        expect(container.querySelectorAll('.ru-card__title')).toHaveLength(3);
    });

    it('counts updates per category in the stats strip', () => {
        const { container } = renderPage({ updates: FIXTURE });

        const stats = Object.fromEntries(
            [...container.querySelectorAll('.ru-stat')].map((s) => [
                s.querySelector('dt').textContent,
                s.querySelector('dd').textContent,
            ])
        );
        expect(stats).toEqual({ Updates: '3', Galleries: '1', Videos: '1', Fixes: '1' });
    });
});

describe('date helpers', () => {
    it('formats ISO dates without a timezone shift', () => {
        expect(formatDate('2026-11-10')).toBe('Nov 10, 2026');
        expect(formatDate('2026-05-01')).toBe('May 1, 2026');
    });

    it('groups consecutive updates by month', () => {
        const groups = groupByMonth([
            { date: '2026-08-10' },
            { date: '2026-08-01' },
            { date: '2026-05-27' },
        ]);
        expect(groups.map((g) => [g.label, g.items.length])).toEqual([
            ['August 2026', 2],
            ['May 2026', 1],
        ]);
    });
});
