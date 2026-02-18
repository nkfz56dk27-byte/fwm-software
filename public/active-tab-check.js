// Funzione per controllare se la tab è attiva e visibile
self.isTabActiveAndVisible = async function () {
  const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const client of clientList) {
    if (client.visibilityState === 'visible' && client.focused) {
      return true;
    }
  }
  return false;
};
