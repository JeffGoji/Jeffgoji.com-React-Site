import { useState } from 'react'

import MockNavVariants from './MockNavVariants'
import MockOptionA from './MockOptionA'
import MockOptionB from './MockOptionB'
import MockOptionC from './MockOptionC'

const OPTIONS = [
    { id: 'a', label: 'A · Featured + Rails', Component: MockOptionA },
    { id: 'b', label: 'B · Filter Grid', Component: MockOptionB },
    { id: 'c', label: 'C · Series Hub', Component: MockOptionC },
    { id: 'nav', label: 'Nav · Flat vs dropdown', Component: MockNavVariants },
]

const STATES = [
    { id: 'ready', label: 'Populated' },
    { id: 'loading', label: 'Loading' },
    { id: 'empty', label: 'Empty' },
    { id: 'error', label: 'Error' },
]

/**
 * MOCKUP HARNESS — the comparison shell the CPO reviews the options in.
 *
 * The state switcher is the reason this is a harness rather than three pages:
 * loading, empty and error are the states a design is normally shown without and
 * then has to grow later. Forcing each option to render all four from the same
 * control is what makes the comparison honest.
 *
 * Remounting on every change (the `key`) is deliberate. Each option holds its own
 * filter and playback state, and carrying a half-filtered Option B into Option C
 * would show the CPO a state no visitor can arrive at.
 *
 * This harness ships nothing to production. It is the review surface only; the
 * chosen option's own component is what gets ported.
 */
function MockupsPreview() {
    const [optionId, setOptionId] = useState('a')
    const [state, setState] = useState('ready')

    const option = OPTIONS.find((entry) => entry.id === optionId) ?? OPTIONS[0]
    const { Component } = option
    const supportsStates = optionId !== 'nav'

    return (
        <div className="vx-preview">
            <header className="vx-preview__bar">
                <span className="vx-preview__brand">Videos hub — design exploration</span>

                <div className="vx-preview__group" role="group" aria-label="Layout option">
                    {OPTIONS.map((entry) => (
                        <button
                            key={entry.id}
                            type="button"
                            className={`chip vx-chip${
                                entry.id === optionId ? ' vx-chip--on' : ''
                            }`}
                            aria-pressed={entry.id === optionId}
                            onClick={() => setOptionId(entry.id)}
                        >
                            {entry.label}
                        </button>
                    ))}
                </div>

                <div className="vx-preview__group">
                    <label className="label" htmlFor="vx-preview-state">
                        State
                    </label>
                    <select
                        id="vx-preview-state"
                        className="select"
                        value={state}
                        onChange={(event) => setState(event.target.value)}
                        disabled={!supportsStates}
                    >
                        {STATES.map((entry) => (
                            <option key={entry.id} value={entry.id}>
                                {entry.label}
                            </option>
                        ))}
                    </select>
                </div>
            </header>

            <main className="vx-preview__stage">
                <Component
                    key={`${optionId}-${state}`}
                    state={state}
                    onRetry={() => setState('ready')}
                />
            </main>
        </div>
    )
}

export default MockupsPreview
