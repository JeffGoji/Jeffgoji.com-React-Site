import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Scrolls to the top on every route change, unless the URL carries a #hash
 * naming an element on the new page (e.g. the What's New page's links to one
 * build-log post, /nd-blog#post-9), in which case it scrolls to that element.
 * The whole route tree has committed by the time this effect runs, so the
 * target is already in the DOM.
 */
function ScrollToTop() {
    const { pathname, hash } = useLocation();

    useEffect(() => {
        const target = hash ? document.getElementById(decodeURIComponent(hash.slice(1))) : null;

        if (target && typeof target.scrollIntoView === "function") {
            target.scrollIntoView({ block: "start", behavior: "instant" });
        } else {
            window.scrollTo(0, 0); // Scroll to the top on route change
        }
    }, [pathname, hash]);

    return null;
}

export default ScrollToTop;
