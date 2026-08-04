import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

import { trackPageview } from '../lib/analytics';

/**
 * Reports one pageview per client-side navigation.
 *
 * React Router swaps route elements without a document load, so a vendor script's own
 * load-time pageview only ever covers the entry URL. This hook owns that side effect so
 * route components stay free of analytics wiring; mount it once inside the router
 * context rather than per route.
 */
export default function usePageviews() {
    const { pathname } = useLocation();

    useEffect(() => {
        trackPageview();
    }, [pathname]);
}
