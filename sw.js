self.addEventListener('push', function (e) {
  const d = e.data ? e.data.json() : {};
  e.waitUntil(
    self.registration.showNotification(d.title || 'Sideline', {
      body:     d.body    || 'Sports update',
      icon:     d.icon    || '/favicon.ico',
      badge:    d.badge   || '/favicon.ico',
      tag:      d.tag     || 'sideline',
      data:     d.data    || {},
      renotify: true,
    })
  );
});

self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  const url = e.notification.data?.url || 'https://fantakes.app';
  e.waitUntil(clients.openWindow(url));
});
