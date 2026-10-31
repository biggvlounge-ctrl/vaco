// VACO Notify service worker — the delivery half of browser webpush.
//
// `lib/notify.js`'s `makeWebPushAdapter` sends a JSON payload shaped
// { title, body, severity, app, notificationId }. This worker's only
// job is turning that into a real OS notification; the Push API
// forces this to live in its own top-level script, loaded with no
// vendor SDK and no build step.

self.addEventListener('push', function (event) {
  var data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (err) {
    data = { title: 'VACO Notify', body: event.data ? event.data.text() : '' };
  }

  var title = data.title || 'VACO Notify';
  var options = {
    body: data.body || '',
    data: data,
  };
  if (data.notificationId) options.tag = 'vaco-notify-' + data.notificationId;

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
});
