/**
 * The ND RF GTS build log.
 *
 * See Miyoshi for why this route is configuration only. Title follows the
 * mockup's "<chassis+model> Build Log" pattern (blog.html:45), read straight
 * from this car's own Cars.json `model` field rather than invented.
 */

import BlogList from '../../common/BlogList';
import { buildCarBanner } from '../../common/carBanner';
import data from '../../../assets/Data/ndBlog.json';

const BANNER = buildCarBanner('Kasumi', data);

const NDBlog = () => <BlogList data={data} title="ND GTS RF Build Log" banner={BANNER} />;

export default NDBlog;
