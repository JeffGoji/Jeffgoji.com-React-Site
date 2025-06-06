import { useEffect } from 'react';

/**
 * Reads VITE_AD_CLIENT and VITE_AD_SLOT from environment.
 * Falls back to empty string if they’re undefined.
 */
const AdSenseSlot = () => {
  // In Vite, any variable that begins with VITE_ is injected at build time:
  const client = import.meta.env.VITE_AD_CLIENT || '';
  const slot   = import.meta.env.VITE_AD_SLOT   || '';

  useEffect(() => {
    if (typeof window !== 'undefined' && window.adsbygoogle) {
      window.adsbygoogle.push({});
    }
  }, []); // run once after mount

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



export default AdSenseSlot;
