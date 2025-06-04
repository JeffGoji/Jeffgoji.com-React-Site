import { useEffect } from 'react';
import PropTypes from 'prop-types';

const AdSenseSlot = ({ client = 'ca-pub-8417979887134577', slot = '1042016675' }) => {
  useEffect(() => {
    // Don't run on the server
    if (typeof window !== 'undefined' && window.adsbygoogle) {
      window.adsbygoogle.push({});
    }
  }, []); // <-- empty deps: run once after mount

  return (
    <ins
      className="adsbygoogle"
      style={{ display: 'block' }}
      data-ad-client={client}
      data-ad-slot={slot}
      data-ad-format="auto"
      data-full-width-responsive="true"
    ></ins>
  );
};

AdSenseSlot.propTypes = {
  client: PropTypes.string,
  slot: PropTypes.string,
};

export default AdSenseSlot;
