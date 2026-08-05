/**
 * The C8 Z51 build log.
 *
 * See Miyoshi for why this route is configuration only and why the heading is
 * carried over rather than re-worded.
 *
 * c8Blog.json entry 2 carries no `cost`; <BlogList> drops the chip rather than
 * printing a bare label, so the gap is cosmetic-free until a real figure is
 * available. No placeholder is invented here.
 */

import BlogList from '../../common/BlogList';
import { buildCarBanner } from '../../common/carBanner';
import data from '../../../assets/Data/c8Blog.json';

const BANNER = buildCarBanner('Panda', data);

const C8Blog = () => <BlogList data={data} title="C8 Z51 Corvette Blog" banner={BANNER} />;

export default C8Blog;
