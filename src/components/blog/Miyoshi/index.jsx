/**
 * The NA6 build log.
 *
 * Task 00035 collapses this route onto the shared <BlogList>, so the component
 * is now its per-car configuration and nothing else. <BlogList> renders the
 * page's own <main>; nothing may wrap it here, because a second <main> is a
 * competing landmark and App.test.jsx fails on it.
 *
 * The heading is the mockup's own title (blog.html:45's `mountBlog` call),
 * swapped in from the pre-V2 "Mazda NA MX5 Blog" per CPO direction.
 */

import BlogList from '../../common/BlogList';
import { buildCarBanner } from '../../common/carBanner';
import data from '../../../assets/Data/naBlog.json';

const BANNER = buildCarBanner('Miyoshi', data);

const NABlog = () => <BlogList data={data} title="NA6 MX-5 Build Log" banner={BANNER} />;

export default NABlog;
