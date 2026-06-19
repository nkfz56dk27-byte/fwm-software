import { useEffect } from 'react';
export default function OneSignalAcceptedListener({ onAccept }) {
  useEffect(() => {
    function handler() {
      onAccept && onAccept();
    }
    window.addEventListener('OneSignalAccepted', handler);
    return () => window.removeEventListener('OneSignalAccepted', handler);
  }, [onAccept]);
  return null;
}