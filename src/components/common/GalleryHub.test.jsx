/**
 * @vitest-environment jsdom
 *
 * Environment is pinned per-file, matching the rest of the suite.
 *
 * Covers Task 00039: the consolidated galleries hub — the switcher over the
 * configured sets, the manifest fetch behind each one, and the loading / empty /
 * missing states around it.
 *
 * Assertions are on structure (roles, block classes, slugs) rather than on the
 * rendered copy, so rewording the hub does not fail the suite.
 */

import { createRequire } from 'node:module'
import { resolve, dirname } from 'node:path'

import * as sass from 'sass'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

import GalleryHub from './GalleryHub'
import { GALLERY_SETS } from './gallerySets'

/** Resolved from the Vitest root; see the note in components/Footer/index.test.jsx. */
const ROOT = process.cwd()
const SCSS_DIR = resolve(ROOT, 'src/scss')
const NODE_MODULES = dirname(
    dirname(createRequire(resolve(ROOT, 'index.html')).resolve('bootstrap/package.json'))
)

const css = sass.compile(resolve(SCSS_DIR, 'styles.scss'), {
    loadPaths: [SCSS_DIR, NODE_MODULES],
    quietDeps: true,
    logger: sass.Logger.silent,
}).css

const SETS = [
    { slug: 'set-one', car: 'Car One', label: 'Set One' },
    { slug: 'set-two', car: 'Car Two', label: 'Set Two' },
]

const itemsFor = (slug, count) =>
    Array.from({ length: count }, (_, index) => ({
        original: `/gallery/${slug}/display/${index}.webp`,
        thumbnail: `/gallery/${slug}/thumbs/${index}.webp`,
        alt: `${slug} frame ${index}`,
    }))

/** The shape the current build script writes, `full` included. */
const FRAME_WITH_FULL = {
    thumbnail: '/gallery/set-one/thumbs/0.webp',
    original: '/gallery/set-one/display/0.webp',
    full: '/gallery/set-one/original/0.jpg',
    alt: 'A frame',
}

const manifestOf = (items) => ({
    ok: true,
    json: async () => ({ id: 'set', label: 'Set', count: items.length, items }),
})

/** Manifests keyed by slug; anything not listed answers the way a 404 does. */
function stubFetch(bySlug) {
    const fetch = vi.fn(async (url) => {
        const slug = url.split('/')[2]

        return slug in bySlug ? manifestOf(bySlug[slug]) : { ok: false, json: async () => ({}) }
    })

    vi.stubGlobal('fetch', fetch)

    return fetch
}

const thumbsIn = (container) => [...container.querySelectorAll('.gallery-grid .thumb')]

beforeEach(() => {
    stubFetch({ 'set-one': itemsFor('set-one', 3), 'set-two': itemsFor('set-two', 2) })
})

afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
})

describe('the switcher offers every configured set', () => {
    it('renders one option per set, in configured order', async () => {
        render(<GalleryHub sets={SETS} />)

        expect(
            [...screen.getByRole('combobox').options].map((option) => option.value)
        ).toEqual(['set-one', 'set-two'])

        await screen.findByRole('button', { name: /1$/ })
    })

    it('ships the real config with a slug and a label for every set', () => {
        expect(GALLERY_SETS.length).toBeGreaterThan(0)

        for (const set of GALLERY_SETS) {
            expect(set.slug).toMatch(/^[a-z0-9-]+$/)
            expect(set.label.length).toBeGreaterThan(0)
            expect(set.car.length).toBeGreaterThan(0)
        }
    })

    it('gives every set a distinct slug, so the switcher cannot collide', () => {
        const slugs = GALLERY_SETS.map((set) => set.slug)

        expect(new Set(slugs).size).toBe(slugs.length)
    })

    it('names the legacy route each set replaces, for the redirect map', () => {
        for (const set of GALLERY_SETS) {
            expect(set.legacyPath.startsWith('/')).toBe(true)
        }
    })

    it('opens on the first set by default', async () => {
        render(<GalleryHub sets={SETS} />)

        expect(screen.getByRole('combobox').value).toBe('set-one')
        expect(fetch).toHaveBeenCalledWith('/gallery/set-one/manifest.json')

        await screen.findByRole('button', { name: /1$/ })
    })

    it('opens on initialSlug when one is given', async () => {
        render(<GalleryHub sets={SETS} initialSlug="set-two" />)

        expect(screen.getByRole('combobox').value).toBe('set-two')
        expect(fetch).toHaveBeenCalledWith('/gallery/set-two/manifest.json')

        await screen.findByRole('button', { name: /1$/ })
    })

    it('falls back to the first set when initialSlug names no configured set', async () => {
        render(<GalleryHub sets={SETS} initialSlug="not-a-set" />)

        expect(screen.getByRole('combobox').value).toBe('set-one')

        await screen.findByRole('button', { name: /1$/ })
    })
})

describe('selecting a set loads and renders that set', () => {
    it('fetches the newly selected slug and swaps the grid onto it', async () => {
        const { container } = render(<GalleryHub sets={SETS} />)

        await waitFor(() => expect(thumbsIn(container)).toHaveLength(3))

        fireEvent.change(screen.getByRole('combobox'), { target: { value: 'set-two' } })

        expect(fetch).toHaveBeenCalledWith('/gallery/set-two/manifest.json')

        await waitFor(() => expect(thumbsIn(container)).toHaveLength(2))

        expect(
            thumbsIn(container).map((thumb) => thumb.querySelector('img').getAttribute('src'))
        ).toEqual(itemsFor('set-two', 2).map((item) => item.thumbnail))
    })

    it('heads the hub with the selected set rather than a fixed title', async () => {
        render(<GalleryHub sets={SETS} />)

        expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Set One')

        fireEvent.change(screen.getByRole('combobox'), { target: { value: 'set-two' } })

        expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Set Two')
    })

    /**
     * Switching twice in quick succession can land the first set's manifest
     * after the second's. Without the effect's own staleness guard that response
     * would repaint the grid with the set the visitor already navigated away
     * from.
     */
    it('ignores a slow response for a set the visitor already left', async () => {
        const pending = {}

        vi.stubGlobal(
            'fetch',
            vi.fn(
                (url) =>
                    new Promise((resolveResponse) => {
                        pending[url.split('/')[2]] = resolveResponse
                    })
            )
        )

        const { container } = render(<GalleryHub sets={SETS} />)

        fireEvent.change(screen.getByRole('combobox'), { target: { value: 'set-two' } })

        pending['set-two'](manifestOf(itemsFor('set-two', 2)))
        await waitFor(() => expect(thumbsIn(container)).toHaveLength(2))

        pending['set-one'](manifestOf(itemsFor('set-one', 3)))
        await new Promise((flush) => setTimeout(flush, 0))

        expect(thumbsIn(container)).toHaveLength(2)
    })
})

describe('the grid is the mockup thumbnail block', () => {
    it('renders one thumb per manifest item', async () => {
        const { container } = render(<GalleryHub sets={SETS} />)

        await waitFor(() => expect(thumbsIn(container)).toHaveLength(3))
    })

    it('grades every thumb with the editorial image treatment', async () => {
        const { container } = render(<GalleryHub sets={SETS} />)

        await waitFor(() => expect(thumbsIn(container)).toHaveLength(3))

        for (const thumb of thumbsIn(container)) {
            expect(thumb.classList.contains('media--editorial')).toBe(true)
        }
    })

    it('numbers the frames with a zero-padded index badge', async () => {
        const { container } = render(<GalleryHub sets={SETS} />)

        await waitFor(() => expect(thumbsIn(container)).toHaveLength(3))

        expect(
            thumbsIn(container).map((thumb) => thumb.querySelector('.thumb__idx').textContent)
        ).toEqual(['01', '02', '03'])
    })

    it('defers every thumbnail below the fold', async () => {
        const { container } = render(<GalleryHub sets={SETS} />)

        await waitFor(() => expect(thumbsIn(container)).toHaveLength(3))

        for (const thumb of thumbsIn(container)) {
            expect(thumb.querySelector('img').getAttribute('loading')).toBe('lazy')
        }
    })

    it('points each thumbnail at the manifest thumb, not the display rendition', async () => {
        const { container } = render(<GalleryHub sets={SETS} />)

        await waitFor(() => expect(thumbsIn(container)).toHaveLength(3))

        expect(
            thumbsIn(container).map((thumb) => thumb.querySelector('img').getAttribute('src'))
        ).toEqual(itemsFor('set-one', 3).map((item) => item.thumbnail))
    })

    it('makes each thumb an operable control, so the lightbox has a trigger', async () => {
        const onSelectImage = vi.fn()

        const { container } = render(<GalleryHub sets={SETS} onSelectImage={onSelectImage} />)

        await waitFor(() => expect(thumbsIn(container)).toHaveLength(3))

        fireEvent.click(thumbsIn(container)[1])

        expect(onSelectImage).toHaveBeenCalledWith(1)
    })

    /**
     * The build script writes `alt` but neither `thumbnailAlt` nor `label`, and
     * an older manifest may carry none of the three — every item still needs an
     * accessible name.
     */
    it('degrades the alt text through the manifest fields it does have', async () => {
        stubFetch({
            'set-one': [
                { thumbnail: '/a.webp', thumbnailAlt: 'preferred', alt: 'second', label: 'third' },
                { thumbnail: '/b.webp', alt: 'second' },
                { thumbnail: '/c.webp', label: 'third' },
                { thumbnail: '/d.webp' },
            ],
        })

        const { container } = render(<GalleryHub sets={SETS} />)

        await waitFor(() => expect(thumbsIn(container)).toHaveLength(4))

        const alts = thumbsIn(container).map((thumb) =>
            thumb.querySelector('img').getAttribute('alt')
        )

        expect(alts.slice(0, 3)).toEqual(['preferred', 'second', 'third'])
        expect(alts[3]).toContain('Set One')
        expect(alts[3].length).toBeGreaterThan(0)
    })
})

/**
 * Task 00060. The grid went through <ResponsiveImage> for its alt contract and
 * its lazy default, and deliberately stopped there.
 */
describe('the grid picks one rendition rather than a candidate list', () => {
    /**
     * The pipeline builds two widths per frame, 320 and 1600, and the grid cell
     * runs roughly 180-330px. A two-candidate list would resolve to the 1600w
     * display rendition on any phone above 1x DPR and pull a full-size photo per
     * tile — the opposite of what this Story is for. Asserting the absence keeps
     * a later "add a srcset" edit from landing without the middle rung that
     * would make it correct.
     */
    it('advertises no srcset while the pipeline builds only two widths', async () => {
        const { container } = render(<GalleryHub sets={SETS} />)

        await waitFor(() => expect(thumbsIn(container)).toHaveLength(3))

        for (const thumb of thumbsIn(container)) {
            const img = thumb.querySelector('img')

            expect(img.hasAttribute('srcset')).toBe(false)
            expect(img.hasAttribute('sizes')).toBe(false)
        }
    })

    /** `full` is the multi-MB source rendition; it must not reach the grid. */
    it('never reaches for the untouched original', async () => {
        stubFetch({ 'set-one': [FRAME_WITH_FULL] })

        const { container } = render(<GalleryHub sets={SETS} />)

        await waitFor(() => expect(thumbsIn(container)).toHaveLength(1))

        expect(container.innerHTML).not.toContain('/original/')
    })
})

/**
 * Task 00075. `full` is carried through normalisation now, because the lightbox
 * download control is the reason the pipeline keeps a full-resolution rendition
 * at all. The rule it used to be dropped under still binds everywhere else: it
 * may be an href a visitor clicks, and nothing the browser resolves unasked.
 */
describe('the full rendition reaches the visitor only through the download control', () => {
    const downloadIn = (container) => container.querySelector('.lightbox__download')

    const openFirstFrame = async (items) => {
        stubFetch({ 'set-one': items })

        const { container } = render(<GalleryHub sets={SETS} />)

        await waitFor(() => expect(thumbsIn(container)).toHaveLength(1))

        fireEvent.click(thumbsIn(container)[0])

        return container
    }

    it('hands the lightbox the full URL from the manifest', async () => {
        const container = await openFirstFrame([FRAME_WITH_FULL])

        expect(downloadIn(container).getAttribute('href')).toBe(FRAME_WITH_FULL.full)
    })

    it('leaves every image on the display rendition', async () => {
        const container = await openFirstFrame([FRAME_WITH_FULL])

        for (const img of container.querySelectorAll('img')) {
            expect(img.getAttribute('src')).not.toBe(FRAME_WITH_FULL.full)
            expect(img.hasAttribute('srcset')).toBe(false)
        }
    })

    /**
     * The deploy serves manifest.json from cache independently of the bundle, so
     * a manifest predating the `full` field can still be the one in front of a
     * current build. A control with no href would be dead chrome.
     */
    it('falls back to the display rendition on a manifest with no full field', async () => {
        const container = await openFirstFrame([
            {
                thumbnail: '/gallery/set-one/thumbs/0.webp',
                original: '/gallery/set-one/display/0.webp',
                alt: 'A frame',
            },
        ])

        expect(downloadIn(container).getAttribute('href')).toBe('/gallery/set-one/display/0.webp')
    })
})

/**
 * Task 00040 wiring. The lightbox's own behaviour is covered in
 * GalleryLightbox.test.jsx; this asserts only the seam — that the hub opens it
 * on the clicked frame, hands it the fetched set, and takes it back down.
 */
describe('a thumb opens the lightbox on that frame', () => {
    const lightboxIn = (container) => container.querySelector('.lightbox')

    it('keeps the lightbox out of the document until a thumb is clicked', async () => {
        const { container } = render(<GalleryHub sets={SETS} />)

        await waitFor(() => expect(thumbsIn(container)).toHaveLength(3))

        expect(lightboxIn(container)).toBeNull()
    })

    it('opens on the clicked frame rather than on the first', async () => {
        const { container } = render(<GalleryHub sets={SETS} />)

        await waitFor(() => expect(thumbsIn(container)).toHaveLength(3))

        fireEvent.click(thumbsIn(container)[1])

        expect(container.querySelector('.lightbox__cap').textContent).toBe(
            '02 / 3 · set-one frame 1'
        )
    })

    it('hands the lightbox the display renditions, not the thumbnails', async () => {
        const { container } = render(<GalleryHub sets={SETS} />)

        await waitFor(() => expect(thumbsIn(container)).toHaveLength(3))

        fireEvent.click(thumbsIn(container)[0])

        expect(
            [...container.querySelectorAll('.lightbox__frame img')].map((img) =>
                img.getAttribute('src')
            )
        ).toEqual(itemsFor('set-one', 3).map((item) => item.original))
    })

    it('closes on Escape, leaving the grid behind it', async () => {
        const { container } = render(<GalleryHub sets={SETS} />)

        await waitFor(() => expect(thumbsIn(container)).toHaveLength(3))

        fireEvent.click(thumbsIn(container)[0])
        expect(lightboxIn(container)).not.toBeNull()

        fireEvent.keyDown(window, { key: 'Escape', keyCode: 27 })

        expect(lightboxIn(container)).toBeNull()
        expect(thumbsIn(container)).toHaveLength(3)
    })

    /**
     * The switcher is behind the overlay, but the manifest for a set switched to
     * earlier can still land while the lightbox is open — and an index into the
     * old set means nothing in the new one.
     */
    it('closes when the visitor switches to another set', async () => {
        const { container } = render(<GalleryHub sets={SETS} />)

        await waitFor(() => expect(thumbsIn(container)).toHaveLength(3))

        fireEvent.click(thumbsIn(container)[2])
        expect(lightboxIn(container)).not.toBeNull()

        fireEvent.change(screen.getByRole('combobox'), { target: { value: 'set-two' } })

        expect(lightboxIn(container)).toBeNull()

        await waitFor(() => expect(thumbsIn(container)).toHaveLength(2))
    })
})

describe('the hub survives a set with no frames behind it', () => {
    it('announces progress while the manifest is in flight', () => {
        const { container } = render(<GalleryHub sets={SETS} />)

        expect(screen.getByRole('status')).toBeDefined()
        expect(container.querySelector('.gallery-grid')).toBeNull()
    })

    it('renders the empty state for a manifest with no items', async () => {
        stubFetch({ 'set-one': [] })

        const { container } = render(<GalleryHub sets={SETS} />)

        await waitFor(() => expect(screen.getByRole('status')).toBeDefined())

        expect(container.querySelector('.gallery-grid')).toBeNull()
    })

    /** Feature C has not built four of the six configured slugs yet. */
    it('renders the empty state when the manifest is missing', async () => {
        stubFetch({})

        const { container } = render(<GalleryHub sets={SETS} />)

        await waitFor(() => expect(screen.getByRole('status')).toBeDefined())

        expect(container.querySelector('.gallery-grid')).toBeNull()
    })

    /**
     * The SPA fallback in public/_redirects answers an unknown path with
     * index.html and a 200, so on the deployed site a missing manifest arrives
     * as HTML that only fails at parse time.
     */
    it('renders the empty state when the SPA fallback answers with HTML', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => ({
                ok: true,
                json: async () => {
                    throw new SyntaxError('Unexpected token <')
                },
            }))
        )

        const { container } = render(<GalleryHub sets={SETS} />)

        await waitFor(() => expect(screen.getByRole('status')).toBeDefined())

        expect(container.querySelector('.gallery-grid')).toBeNull()
    })

    it('renders the empty state when the request itself fails', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => {
                throw new TypeError('Failed to fetch')
            })
        )

        const { container } = render(<GalleryHub sets={SETS} />)

        await waitFor(() => expect(screen.getByRole('status')).toBeDefined())

        expect(container.querySelector('.gallery-grid')).toBeNull()
    })

    it('keeps the switcher usable in the empty state, so a set is still reachable', async () => {
        stubFetch({ 'set-two': itemsFor('set-two', 2) })

        const { container } = render(<GalleryHub sets={SETS} />)

        await waitFor(() => expect(screen.getByRole('status')).toBeDefined())

        fireEvent.change(screen.getByRole('combobox'), { target: { value: 'set-two' } })

        await waitFor(() => expect(thumbsIn(container)).toHaveLength(2))
    })
})

/** jsdom performs no layout, so these read the compiled stylesheet instead. */
describe('the grid reflows on measure rather than on breakpoints', () => {
    it('fills columns against a 180px floor', () => {
        expect(css).toMatch(
            /\.gallery-grid \{[^}]*grid-template-columns: repeat\(auto-fill, minmax\(180px, 1fr\)\)/
        )
    })

    it('holds every frame square', () => {
        expect(css).toMatch(/\.thumb \{[^}]*aspect-ratio: 1/)
    })

    it('lifts the index badge clear of the editorial grade overlay', () => {
        const grade = css.match(/\.media--editorial::after \{([^}]*)\}/)
        const badge = css.match(/\.thumb__idx \{([^}]*)\}/)

        expect(grade).not.toBeNull()
        expect(badge).not.toBeNull()

        const zIndexOf = (rule) => Number(rule[1].match(/z-index: (\d+)/)[1])

        expect(zIndexOf(badge)).toBeGreaterThan(zIndexOf(grade))
    })

    it('constrains the hub to the mockup measure', () => {
        expect(css).toMatch(/\.gallery-hub__inner \{[^}]*max-width: var\(--container-max\)/)
    })
})
