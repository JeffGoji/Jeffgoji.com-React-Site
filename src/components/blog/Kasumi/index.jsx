/**
 * The ND RF GTS build log.
 *
 * See Miyoshi for why this route is configuration only and why the heading is
 * carried over rather than re-worded.
 */

import BlogList from '../../common/BlogList';
import { buildCarBanner } from '../../common/carBanner';
import data from '../../../assets/Data/ndBlog.json';

const BANNER = buildCarBanner('Kasumi', data);

const NDBlog = () => <BlogList data={data} title="Mazda MX5 RF GTS Blog" banner={BANNER} />;

export default NDBlog;
