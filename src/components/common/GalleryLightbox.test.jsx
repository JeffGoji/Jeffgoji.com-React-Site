/**
 * @vitest-environment jsdom
 *
 * Environment is pinned per-file, matching the rest of the suite.
 *
 * Covers Task 00040: the gallery lightbox — the mockup's overlay chrome, the
 * caption format, wrap-around navigation, and the two ways out (Escape and the
 * close control).
 *
 * Each navigating test performs exactly ONE move. react-image-gallery throttles
 * slideToIndex to the slide duration and refuses a second slide while the first
 * is still transitioning, so a test that moved twice would be asserting on the
 * library's throttle rather than on this component.
 */

import { createRequire } from 'node:module'
import { resolve, dirname } from 'node:path'

import * as sass from 'sass'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import GalleryLightbox from './GalleryLightbox'

/** Resolved from the Vitest root; see the note in GalleryHub.test.jsx. */
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

const FRAMES = [
    { original: '/display/0.webp', thumbnail: '/thumbs/0.webp', alt: 'First frame' },
    { original: '/display/1.webp', thumbnail: '/thumbs/1.webp', alt: 'Second frame' },
    { original: '/display/2.webp', thumbnail: '/thumbs/2.webp', alt: 'Third frame' },
]

const open = (props = {}) =>
    render(<GalleryLightbox items={FRAMES} onClose={() => {}} {...props} />)

const captionIn = (container) => container.querySelector('.lightbox__cap').textContent

/** keyCode is what react-image-gallery reads; `key` alone leaves it at 0. */
const ARROW_LEFT = { key: 'ArrowLeft', keyCode: 37 }
const ARROW_RIGHT = { key: 'ArrowRight', keyCode: 39 }

afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
})

describe('the overlay is the mockup lightbox', () => {
    it('presents itself as a modal dialog', () => {
        const { container } = open()

        expect(container.querySelector('.lightbox')).not.toBeNull()
        expect(screen.getByRole('dialog').getAttribute('aria-modal')).toBe('true')
    })

    it('carries the mockup close and nav controls', () => {
        const { container } = open()

        expect(container.querySelector('.lightbox__close')).not.toBeNull()
        expect(container.querySelector('.lightbox__nav--prev')).not.toBeNull()
        expect(container.querySelector('.lightbox__nav--next')).not.toBeNull()
        expect(container.querySelector('.lightbox__stage')).not.toBeNull()
    })

    it('grades the displayed frame with the soft editorial treatment', () => {
        const { container } = open()

        const frames = [...container.querySelectorAll('.lightbox__frame')]

        expect(frames.length).toBe(FRAMES.length)

        for (const frame of frames) {
            expect(frame.classList.contains('media--editorial')).toBe(true)
            expect(frame.classList.contains('media--editorial--soft')).toBe(true)
        }
    })

    /** The grade reads `.media--editorial > img`, so nothing may sit between. */
    it('keeps the image a direct child of the graded wrapper', () => {
        const { container } = open()

        for (const frame of container.querySelectorAll('.lightbox__frame')) {
            expect(frame.firstElementChild.tagName).toBe('IMG')
        }
    })

    it('shows the display rendition rather than the thumbnail', () => {
        const { container } = open()

        expect(
            [...container.querySelectorAll('.lightbox__frame img')].map((img) =>
                img.getAttribute('src')
            )
        ).toEqual(FRAMES.map((frame) => frame.original))
    })

    it('names every frame from the shape the hub passes down', () => {
        const { container } = open()

        expect(
            [...container.querySelectorAll('.lightbox__frame img')].map((img) =>
                img.getAttribute('alt')
            )
        ).toEqual(FRAMES.map((frame) => frame.alt))
    })

    it('locks the page behind the overlay and gives it back on close', () => {
        const { unmount } = open()

        expect(document.body.style.overflow).toBe('hidden')

        unmount()

        expect(document.body.style.overflow).toBe('')
    })

    /** A visitor arriving by keyboard must not be left on the thumb behind. */
    it('moves focus into the overlay', () => {
        const { container } = open()

        expect(document.activeElement).toBe(container.querySelector('.lightbox__close'))
    })
})

describe('the caption reads NN / total · label', () => {
    it('opens on the frame it was given', () => {
        const { container } = open({ startIndex: 1 })

        expect(captionIn(container)).toBe('02 / 3 · Second frame')
    })

    it('opens on the first frame when no index is given', () => {
        const { container } = open()

        expect(captionIn(container)).toBe('01 / 3 · First frame')
    })

    it('zero-pads the index and counts the whole set', () => {
        const { container } = render(
            <GalleryLightbox
                items={Array.from({ length: 12 }, (_, index) => ({
                    original: `/display/${index}.webp`,
                    thumbnail: `/thumbs/${index}.webp`,
                    alt: `Frame ${index}`,
                }))}
                startIndex={9}
                onClose={() => {}}
            />
        )

        expect(captionIn(container)).toBe('10 / 12 · Frame 9')
    })

    it('follows the frame the visitor moves to', () => {
        const { container } = open()

        fireEvent.click(container.querySelector('.lightbox__nav--next'))

        expect(captionIn(container)).toBe('02 / 3 · Second frame')
    })
})

describe('navigation wraps at both ends', () => {
    it('advances on next', () => {
        const { container } = open({ startIndex: 0 })

        fireEvent.click(container.querySelector('.lightbox__nav--next'))

        expect(captionIn(container)).toBe('02 / 3 · Second frame')
    })

    it('goes back on prev', () => {
        const { container } = open({ startIndex: 2 })

        fireEvent.click(container.querySelector('.lightbox__nav--prev'))

        expect(captionIn(container)).toBe('02 / 3 · Second frame')
    })

    it('wraps from the last frame to the first', () => {
        const { container } = open({ startIndex: 2 })

        fireEvent.click(container.querySelector('.lightbox__nav--next'))

        expect(captionIn(container)).toBe('01 / 3 · First frame')
    })

    it('wraps from the first frame to the last', () => {
        const { container } = open({ startIndex: 0 })

        fireEvent.click(container.querySelector('.lightbox__nav--prev'))

        expect(captionIn(container)).toBe('03 / 3 · Third frame')
    })
})

describe('the keyboard drives the set', () => {
    it('moves forward on the right arrow', () => {
        const { container } = open({ startIndex: 0 })

        fireEvent.keyDown(window, ARROW_RIGHT)

        expect(captionIn(container)).toBe('02 / 3 · Second frame')
    })

    it('moves back on the left arrow', () => {
        const { container } = open({ startIndex: 1 })

        fireEvent.keyDown(window, ARROW_LEFT)

        expect(captionIn(container)).toBe('01 / 3 · First frame')
    })

    it('wraps on the arrow keys too', () => {
        const { container } = open({ startIndex: 0 })

        fireEvent.keyDown(window, ARROW_LEFT)

        expect(captionIn(container)).toBe('03 / 3 · Third frame')
    })
})

describe('the overlay has three ways out', () => {
    it('closes on Escape', () => {
        const onClose = vi.fn()

        open({ onClose })

        fireEvent.keyDown(window, { key: 'Escape', keyCode: 27 })

        expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('closes on the close control', () => {
        const onClose = vi.fn()
        const { container } = open({ onClose })

        fireEvent.click(container.querySelector('.lightbox__close'))

        expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('closes on the backdrop', () => {
        const onClose = vi.fn()
        const { container } = open({ onClose })

        fireEvent.click(container.querySelector('.lightbox'))

        expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('stays open when the chrome inside it is clicked', () => {
        const onClose = vi.fn()
        const { container } = open({ onClose })

        fireEvent.click(container.querySelector('.lightbox__stage'))

        expect(onClose).not.toHaveBeenCalled()
    })

    /** The listener is on window; it must not outlive the overlay. */
    it('stops answering Escape once closed', () => {
        const onClose = vi.fn()
        const { unmount } = open({ onClose })

        unmount()
        fireEvent.keyDown(window, { key: 'Escape', keyCode: 27 })

        expect(onClose).not.toHaveBeenCalled()
    })
})

/** jsdom performs no layout, so these read the compiled stylesheet instead. */
describe('the overlay covers the viewport at any size', () => {
    it('pins the overlay to the viewport above the page', () => {
        expect(css).toMatch(/\.lightbox \{[^}]*position: fixed/)
        expect(css).toMatch(/\.lightbox \{[^}]*inset: 0/)
        expect(css).toMatch(/\.lightbox \{[^}]*z-index: 100/)
    })

    it('sizes the stage against the viewport rather than a breakpoint', () => {
        expect(css).toMatch(/\.lightbox__stage \{[^}]*width: min\(1100px, 92vw\)/)
        expect(css).toMatch(/\.lightbox__stage \{[^}]*max-height: 78vh/)
    })

    it('fits the frame inside the stage without cropping it', () => {
        expect(css).toMatch(
            /\.lightbox__stage \.image-gallery-slide \.image-gallery-image \{[^}]*object-fit: contain/
        )
    })

    it('keeps the nav controls off the stage edges', () => {
        expect(css).toMatch(/\.lightbox__nav--prev \{[^}]*left: var\(--space-5\)/)
        expect(css).toMatch(/\.lightbox__nav--next \{[^}]*right: var\(--space-5\)/)
    })
})
