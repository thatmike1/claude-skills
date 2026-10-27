/**
 * visits.js — visit beacon for readout documents.
 *
 * CLASSIC (non-module) script, loaded by every compiled page via
 *   <script src="../_shared/visits.js"></script>
 *
 * Records one row per tab-session per doc into the readout_visits PocketBase
 * collection (same origin, public create, superuser-only read — viewer names
 * are not exposed to other visitors). The viewer name reuses the identity the
 * comment widget remembers (localStorage `readout_author`); before someone has
 * ever commented they show up as "anonymous".
 *
 * No-ops on file:// copies AND on localhost, so local testing never pollutes
 * the analytics. On protected readouts this script rides inside the encrypted
 * payload, so a visit is only recorded after a successful unlock.
 */
(function () {
    var proto = location.protocol;
    if (proto !== "http:" && proto !== "https:") return;
    var host = location.hostname;
    if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") return;

    // docId matches comments.js: pathname minus leading slash and ".html"
    var docId = location.pathname.replace(/^\/+/, "").replace(/\.html$/i, "");
    if (!docId) docId = "index";

    // dedupe: one visit per doc per tab session (refreshes don't spam the log)
    var seenKey = "readout_visited:" + docId;
    try {
        if (sessionStorage.getItem(seenKey)) return;
    } catch (e) {
        /* sessionStorage unavailable — record anyway */
    }

    var viewer = "anonymous";
    try {
        viewer = localStorage.getItem("readout_author") || "anonymous";
    } catch (e) {
        /* localStorage unavailable */
    }

    var payload = JSON.stringify({
        doc_id: docId.slice(0, 200),
        viewer: viewer.slice(0, 80),
        ua: (navigator.userAgent || "").slice(0, 300),
        referrer: (document.referrer || "").slice(0, 500),
    });
    var url = location.origin + "/api/collections/readout_visits/records";

    var sent = false;
    if (navigator.sendBeacon) {
        try {
            sent = navigator.sendBeacon(url, new Blob([payload], { type: "application/json" }));
        } catch (e) {
            /* fall through to fetch */
        }
    }
    if (!sent) {
        fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: payload,
            keepalive: true,
        }).catch(function () {});
    }
    try {
        sessionStorage.setItem(seenKey, "1");
    } catch (e) {
        /* best effort */
    }
})();
