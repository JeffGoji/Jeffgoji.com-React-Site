/**
 * The Mazdaspeed Miata build log.
 *
 * See Miyoshi for why this route is configuration only and why the heading is
 * carried over rather than re-worded.
 */

import BlogList from '../../common/BlogList';
import { buildCarBanner } from '../../common/carBanner';
import data from '../../../assets/Data/MsmBlog.json';

const BANNER = buildCarBanner('Kiryu', data);

const MsmBlog = () => <BlogList data={data} title="Mazdaspeed Miata Blog" banner={BANNER} />;

export default MsmBlog;
