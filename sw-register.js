if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./service-worker.js")
      .then(() => console.log("Service Worker registado"))
      .catch(err => console.error("Erro no Service Worker:", err));
  });
}
