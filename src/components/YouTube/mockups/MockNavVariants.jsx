import { Nav, NavDropdown } from 'react-bootstrap'
import { Link, NavLink } from 'react-router-dom'

import { SAMPLE_PLAYLISTS } from './sampleVideos'

/**
 * MOCKUP — the two nav treatments for "Videos", side by side.
 *
 * The site currently ships the flat link (NavMenu, `/youtube`). The dropdown is
 * the alternative, built the way the Galleries panel is built, so the comparison
 * is between two things that both already exist in this codebase rather than
 * between a real thing and a description of one.
 *
 * The dropdown is deliberately ONE level deep, unlike Galleries' car -> set
 * nesting. Galleries needs two because a set is only meaningful under a car;
 * a video series is meaningful on its own, and the nested Dropdown-inside-
 * NavDropdown construction is the one that had to be pushed `drop="start"` to
 * stop clipping off the viewport edge (Task 00081). Not inheriting that problem
 * is worth more than the symmetry.
 *
 * Both panels render real react-bootstrap components, so the collapse behaviour,
 * the `eventKey` requirement and the active-underline treatment are the site's
 * actual ones. `eventKey` is set explicitly on every item for the reason Bug
 * 00080 documented: react-bootstrap derives its key from `href`, these render
 * through react-router's `to`, and a null key silently breaks `collapseOnSelect`
 * so the mobile accordion never retracts.
 */
function MockNavVariants() {
    return (
        <div className="vx-hub">
            <div className="vx-hub__inner">
                <div className="vx-navdemo">
                    <section className="vx-navdemo__panel">
                        <div className="eyebrow">Variant 1 — today</div>
                        <h2 className="vx-state__title">Flat link</h2>
                        <div className="vx-navdemo__bar site-nav">
                            <Nav>
                                <Nav.Link as={NavLink} to="/garage" eventKey="/garage">
                                    Car Blogs
                                </Nav.Link>
                                <Nav.Link as={NavLink} to="/youtube" eventKey="/youtube">
                                    Videos
                                </Nav.Link>
                                <Nav.Link as={NavLink} to="/suspension" eventKey="/suspension">
                                    Suspension
                                </Nav.Link>
                            </Nav>
                        </div>
                        <p className="vx-navdemo__note">
                            One click to the hub, no discovery of what is inside it. Costs
                            nothing, teaches nothing. Correct while the hub is three videos;
                            wrong once the hub is the channel.
                        </p>
                    </section>

                    <section className="vx-navdemo__panel">
                        <div className="eyebrow">Variant 2 — proposed</div>
                        <h2 className="vx-state__title">Dropdown, one level</h2>
                        <div className="vx-navdemo__bar site-nav">
                            <Nav>
                                <Nav.Link as={NavLink} to="/garage" eventKey="/garage">
                                    Car Blogs
                                </Nav.Link>
                                <NavDropdown title="Videos" id="vx-videos-nav-dropdown">
                                    <NavDropdown.Item
                                        as={Link}
                                        to="/youtube"
                                        eventKey="videos-all"
                                    >
                                        All videos
                                    </NavDropdown.Item>
                                    <NavDropdown.Divider />
                                    {SAMPLE_PLAYLISTS.map((playlist) => (
                                        <NavDropdown.Item
                                            key={playlist.id}
                                            as={Link}
                                            to={`/youtube?series=${playlist.id}`}
                                            eventKey={playlist.id}
                                        >
                                            {playlist.title}
                                        </NavDropdown.Item>
                                    ))}
                                </NavDropdown>
                                <Nav.Link as={NavLink} to="/suspension" eventKey="/suspension">
                                    Suspension
                                </Nav.Link>
                            </Nav>
                        </div>
                        <p className="vx-navdemo__note">
                            The panel is the channel&apos;s table of contents. Every entry is a
                            deep link into the hub with the series in the query, which is the
                            same construction `galleryHubPath(slug)` already uses — and the
                            same one Bug 00079 proved has to point at the hub rather than at a
                            legacy route that redirects and drops the selection.
                        </p>
                    </section>
                </div>
            </div>
        </div>
    )
}

export default MockNavVariants
