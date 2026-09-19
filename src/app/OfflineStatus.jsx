import { useEffect, useState } from 'react';
import { t } from '../utils/i18n';

export default function OfflineStatus() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
    let active = true;
    const base = new URL(import.meta.env.BASE_URL, document.baseURI);
    navigator.serviceWorker.register(new URL('sw.js', base), { scope: base.pathname })
      .then(() => navigator.serviceWorker.ready)
      .then(() => { if (active) setReady(true); })
      .catch(() => { /* Local saving remains available if offline caching is denied. */ });
    return () => { active = false; };
  }, []);
  return ready ? <span className="text-xs opacity-70">{t('offlineReady')}</span> : null;
}
