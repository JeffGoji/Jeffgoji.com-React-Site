import NavMenu from '../NavMenu'

/**
 * Site banner.
 *
 * This element is a landmark only — it paints nothing, because the bar's chrome
 * belongs to `.site-nav` / `.site-nav__inner` (Task 00020). `.site-header` is
 * therefore `display: contents`, which keeps the banner landmark while removing
 * the wrapper's box from the layout tree.
 *
 * That box is not cosmetic overhead: `.site-nav` is `position: sticky`, and a
 * sticky box is constrained to its containing block. A wrapper exactly as tall
 * as the bar leaves a zero-length offset range, so the bar scrolls away like a
 * static one and the sticky declaration never engages. The mockups hang their
 * `.nav` straight off <body> for the same reason.
 *
 * The `container-fluid p-0` pair this replaced was pre-V2 Bootstrap chrome and
 * a no-op besides: on a block-level <header>, `container-fluid`'s width:100% and
 * auto margins were already the default, and `p-0` existed only to cancel that
 * same class's gutter. What it did do was declare `--bs-gutter-x: 1.5rem`,
 * leaking a Bootstrap default into the nav subtree below it.
 */
function Header() {
    return (
        <header className="site-header">
            <NavMenu />
        </header>
    )
}

export default Header
