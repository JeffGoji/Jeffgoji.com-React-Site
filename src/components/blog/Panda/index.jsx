/**
 * The C8 Z51 build log.
 *
 * See Miyoshi for why this route is configuration only. Title follows the
 * mockup's "<chassis+model> Build Log" pattern (blog.html:45), read straight
 * from this car's own Cars.json `model` field rather than invented.
 *
 * c8Blog.json entry 2 carries no `cost`; <BlogList> drops the chip rather than
 * printing a bare label, so the gap is cosmetic-free until a real figure is
 * available. No placeholder is invented here -- CPO direction (2026-08-05) is
 * to leave it as-is.
 */

import BlogList from '../../common/BlogList';
import { buildCarBanner } from '../../common/carBanner';
import data from '../../../assets/Data/c8Blog.json';

const BANNER = buildCarBanner('Panda', data);

const C8Blog = () => <BlogList data={data} title="C8 Corvette Z51 Build Log" banner={BANNER} />;

export default C8Blog;
