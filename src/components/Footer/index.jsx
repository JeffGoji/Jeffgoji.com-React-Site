import { Link } from 'react-router-dom'

/**
 * Injected as markup rather than referenced with <img src> for the same reason
 * the nav does it: the wordmark is live <text>, so it only resolves the
 * self-hosted Archivo / Space Mono faces when it lives in this document. See
 * components/NavMenu/index.jsx for the full note.
 */
import logoMarkup from '../../assets/logo.svg?raw'

/**
 * Site footer.
 *
 * This component existed but had never been mounted — nothing imported it. Task
 * 00023 renders it for the first time and rebuilds its markup onto the mockups'
 * `.footer` block (assets/app.js renderShell, assets/app.css:356-361 and :575),
 * ported onto `.site-footer` in src/scss/styles.scss.
 *
 * The pre-V2 markup was `fixed-bottom`, which pinned the bar to the viewport and
 * overlaid page content on any page taller than one screen. The mockup footer
 * flows at the end of the document instead and earns its separation from
 * `margin-top`, so that class is deliberately gone.
 *
 * The year is read at render rather than through the previous useState/useEffect
 * pair: that pair painted an empty year on first commit and only filled it in on
 * the effect pass, and the value is a pure derivation with no reason to sit in
 * state.
 *
 * Two link targets deviate from the mockup, both because the mockup names a page
 * this app does not have: "Design System" is a mockup-only surface with no route,
 * replaced here by /suspension (which the nav also carries), and "What's New"
 * shipped ahead of its destination exactly as it did in the nav — /whats-new
 * dead-ended until Task 00064 registered it.
 */
function Footer() {
    const currentYear = new Date().getFullYear()

    return (
        <footer className="site-footer">
            <div className="checker-strip" />
            <div className="site-footer__inner">
                <div>
                    <Link
                        to="/"
                        aria-label="jeffgoji.com home"
                        className="logo"
                        dangerouslySetInnerHTML={{ __html: logoMarkup }}
                    />
                    <p className="site-footer__blurb">
                        A single-driver garage log — Miata NA/MSM/ND, Corvette C8, autocross
                        and great drives. Built by Jeff &quot;Goji&quot; Anderson-Lester.
                    </p>
                </div>
                <div>
                    <h4>Garage</h4>
                    <Link to="/garage">Car Blogs</Link>
                    <Link to="/na-blog">NA6 · Miyoshi</Link>
                    <Link to="/nd-blog">ND RF · Kasumi</Link>
                    <Link to="/c8-blog">C8 Z51 · Panda</Link>
                </div>
                <div>
                    <h4>More</h4>
                    <Link to="/galleries">Galleries</Link>
                    <Link to="/youtube">Videos</Link>
                    <Link to="/whats-new">What&apos;s New</Link>
                    <Link to="/suspension">Suspension</Link>
                </div>
            </div>
            <div className="site-footer__bottom">
                © {currentYear} jeffgoji.com — no cookies, no nonsense. Analytics: cookieless.
            </div>
        </footer>
    )
}

export default Footer
