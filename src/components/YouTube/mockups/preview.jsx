import React from 'react'
import ReactDOM from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'

import MockupsPreview from './MockupsPreview'

import '../../../scss/styles.scss'
import './videos-mockups.css'

/**
 * MOCKUP ENTRY — a second, dev-only Vite entry point.
 *
 * It exists so the exploration is reviewable without touching src/App.jsx's
 * route table or src/main.jsx. Vite's dev server serves any .html in the project
 * tree at its own path, and `vite build` only ever reads index.html, so this
 * entry is unreachable in production by construction rather than by discipline.
 *
 * THE ONE PRODUCTION IMPORT
 * `../../../scss/styles.scss` is the site's single stylesheet, pulled in
 * read-only. A self-contained copy of the token layer was the alternative and it
 * is the wrong one: the entire question the CPO is answering is "does this feel
 * native to the site", and a copied palette answers it against a snapshot that
 * starts drifting the moment it is taken. Nothing here writes to that file or to
 * any other production module.
 *
 * MemoryRouter rather than BrowserRouter: the nav comparison renders real
 * <NavLink>s, which need a router context, and a memory history keeps a click in
 * the mockup from changing the address bar of a page that has no routes.
 */
ReactDOM.createRoot(document.getElementById('mockup-root')).render(
    <React.StrictMode>
        <MemoryRouter>
            <MockupsPreview />
        </MemoryRouter>
    </React.StrictMode>
)
