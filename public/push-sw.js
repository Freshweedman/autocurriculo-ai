self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(self.registration.showNotification(data.title || "Novas vagas", { body: data.body || "Há novas vagas para revisar.", icon: "/icon-192.png", data: { url: data.url || "/dashboard/automacao" } }));
});
self.addEventListener("notificationclick", (event) => { event.notification.close(); event.waitUntil(clients.openWindow(event.notification.data?.url || "/dashboard/automacao")); });
