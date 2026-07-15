(async function () {
  try {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(registration => registration.unregister()));
    }

    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(key => caches.delete(key)));
    }

    const resetKey = "pps_hotfix_cache_reset_v1";
    if (!sessionStorage.getItem(resetKey)) {
      sessionStorage.setItem(resetKey, "1");
      const url = new URL(window.location.href);
      url.searchParams.set("v", Date.now().toString());
      window.location.replace(url.toString());
    }
  } catch (error) {
    console.warn("Keša atiestatīšana neizdevās:", error);
  }
})();
