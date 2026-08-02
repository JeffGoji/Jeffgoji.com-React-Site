import usePageviews from '../../hooks/usePageviews';

/**
 * Renders nothing; exists only to give `usePageviews` a mount point inside the router
 * context, since `App` itself sits outside `BrowserRouter`.
 */
function PageviewTracker() {
    usePageviews();

    return null;
}

export default PageviewTracker;
