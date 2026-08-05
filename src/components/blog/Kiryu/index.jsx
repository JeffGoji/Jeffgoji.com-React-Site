/**
 * The Mazdaspeed Miata build log.
 *
 * See Miyoshi for why this route is configuration only. Title follows the
 * mockup's "<chassis+model> Build Log" pattern (blog.html:45), read straight
 * from this car's own Cars.json `model` field rather than invented.
 */

import BlogList from '../../common/BlogList';
import { buildCarBanner } from '../../common/carBanner';
import data from '../../../assets/Data/MsmBlog.json';

const BANNER = buildCarBanner('Kiryu', data);

const MsmBlog = () => <BlogList data={data} title="NB Mazdaspeed Build Log" banner={BANNER} />;

export default MsmBlog;
