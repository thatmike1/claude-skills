/**
 * comments.js — anchored comment layer for readout documents.
 *
 * CLASSIC (non-module) script, loaded by every compiled page via
 *   <script src="../_shared/comments.js"></script>
 *
 * Transport is PocketBase, served SAME-ORIGIN with the static site
 * (https://readout.ssscribe.app), so this needs NO injected config and NO
 * keys — it talks to /api/collections/readout_comments/records on its own
 * origin.
 *
 * It no-ops unless the page is served over http/https, so a locally-opened
 * file:// copy stays a clean, read-only document. localhost IS supported for
 * testing (that is still http/https).
 *
 * Anchors are COMPILE-TIME: the HTML already carries `data-anchor` attributes
 * on every commentable block (masthead = "masthead", sections = "s-<slug>",
 * blocks = "<section-slug>-<type>-<n>"). The widget just selects `[data-anchor]`
 * — no runtime hashing, so comments re-attach deterministically on every visit.
 *
 * Identity is a remembered name (localStorage key `readout_author`). No auth —
 * internal-team surface. The PocketBase createRule is public; row shape is
 * enforced by the collection's field required/max constraints.
 */
(function () {
    // guard: only activate over http/https (file:// stays a clean document)
    var proto = location.protocol;
    if (proto !== "http:" && proto !== "https:") return;

    // docId = pathname minus leading slash and trailing ".html"
    // e.g. "/pracino/auth-flow.html" -> "pracino/auth-flow"
    var docId = location.pathname.replace(/^\/+/, "").replace(/\.html$/i, "");
    if (!docId) docId = "index";

    var API = location.origin + "/api/collections/readout_comments/records";

    // ---- minimal, theme-aware styling (reads the active theme's CSS vars) ----
    function injectStyle() {
        var css = [
            ".cmt-pin{position:absolute;top:.4rem;right:-2.4rem;width:1.7rem;height:1.7rem;",
            "display:flex;align-items:center;justify-content:center;border-radius:999px;cursor:pointer;",
            "font:600 .72rem/1 var(--sans,system-ui);border:1px solid var(--accent-border,rgba(200,85,61,.45));",
            "background:var(--accent-tint,rgba(200,85,61,.12));color:var(--accent,#c8553d);",
            "opacity:0;transition:opacity .12s ease;user-select:none;z-index:5}",
            "[data-anchor]{position:relative}",
            "[data-anchor]:hover>.cmt-pin,.cmt-pin.has{opacity:1}",
            ".cmt-pin.has{background:var(--accent,#c8553d);color:var(--bg,#15120e);border-color:var(--accent,#c8553d)}",
            ".cmt-pop{position:absolute;z-index:40;width:300px;max-width:80vw;",
            "background:var(--surface-2,#221d17);border:1px solid var(--hairline,#3b3326);",
            "border-radius:calc(var(--radius,2px) + 5px);box-shadow:0 12px 40px rgba(0,0,0,.5);",
            "padding:.85rem;font-family:var(--sans,system-ui);color:var(--text,#e5dbc8)}",
            ".cmt-pop h4{margin:0 0 .55rem;font:600 .7rem/1 var(--sans,system-ui);",
            "letter-spacing:.08em;text-transform:uppercase;color:var(--text-faint,#7e745c)}",
            ".cmt-thread{display:flex;flex-direction:column;gap:.6rem;max-height:240px;overflow:auto;margin-bottom:.6rem}",
            ".cmt-item .who{font:600 .78rem/1.2 var(--sans);color:var(--text-strong,#f4ecda)}",
            ".cmt-item .when{font:.66rem/1 var(--sans);color:var(--text-faint,#7e745c);margin-left:.4rem}",
            ".cmt-item .body{font:.85rem/1.5 var(--sans);color:var(--text,#e5dbc8);margin-top:.15rem;white-space:pre-wrap}",
            ".cmt-pop input,.cmt-pop textarea{width:100%;box-sizing:border-box;background:var(--surface,#1d1914);",
            "border:1px solid var(--hairline,#3b3326);border-radius:4px;color:var(--text,#e5dbc8);",
            "font:.85rem/1.4 var(--sans);padding:.45rem .55rem;margin-bottom:.45rem}",
            ".cmt-pop textarea{resize:vertical;min-height:60px}",
            ".cmt-pop .row{display:flex;gap:.5rem;align-items:center;justify-content:flex-end}",
            ".cmt-pop .err{font:.72rem/1.4 var(--sans);color:var(--danger,#c8553d);margin:0 0 .45rem}",
            ".cmt-pop button{font:600 .78rem/1 var(--sans);padding:.45rem .8rem;border-radius:4px;cursor:pointer;",
            "background:var(--accent,#c8553d);color:var(--bg,#15120e);border:none}",
            ".cmt-pop button.ghost{background:transparent;color:var(--text-faint,#7e745c);border:1px solid var(--hairline,#3b3326)}",
            "@media(max-width:1100px){.cmt-pin{right:.3rem}}",
        ].join("");
        var s = document.createElement("style");
        s.textContent = css;
        document.head.appendChild(s);
    }

    // ---- network (PocketBase REST) ------------------------------------------

    /** fetch all comments for this doc, oldest first. perPage=500 is the cap —
     *  a single readout is not expected to exceed that, so no pagination. */
    function fetchAll() {
        var url =
            API +
            "?filter=" +
            encodeURIComponent("(doc_id='" + docId + "')") +
            "&sort=created&perPage=500";
        return fetch(url, { headers: { Accept: "application/json" } }).then(function (r) {
            if (!r.ok) return [];
            return r.json().then(function (j) {
                return (j && j.items) || [];
            });
        });
    }

    /** create one comment; resolves to the saved record, rejects on HTTP error. */
    function post(anchor, author, body) {
        return fetch(API, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({ doc_id: docId, anchor_id: anchor, author: author, body: body }),
        }).then(function (r) {
            if (!r.ok) return Promise.reject(r);
            return r.json();
        });
    }

    // ---- ui -----------------------------------------------------------------
    var byAnchor = {}; // anchor_id -> [comment]
    var openPop = null;

    function close() {
        if (openPop) openPop.remove();
        openPop = null;
    }
    document.addEventListener("keydown", function (e) {
        if (e.key === "Escape") close();
    });
    document.addEventListener("click", function (e) {
        if (openPop && !openPop.contains(e.target) && !e.target.classList.contains("cmt-pin"))
            close();
    });

    function fmt(ts) {
        try {
            return new Date(ts).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
            });
        } catch (_) {
            return "";
        }
    }

    /** textContent-based HTML escaping — all user content passes through this. */
    function esc(s) {
        var d = document.createElement("div");
        d.textContent = s == null ? "" : s;
        return d.innerHTML;
    }

    function openThread(block, anchor, pin) {
        close();
        var list = byAnchor[anchor] || [];
        var pop = document.createElement("div");
        pop.className = "cmt-pop";
        var thread =
            '<div class="cmt-thread">' +
            (list.length
                ? list
                      .map(function (c) {
                          return (
                              '<div class="cmt-item"><div><span class="who">' +
                              esc(c.author) +
                              '</span><span class="when">' +
                              fmt(c.created) +
                              '</span></div><div class="body">' +
                              esc(c.body) +
                              "</div></div>"
                          );
                      })
                      .join("")
                : '<div class="cmt-item"><div class="body" style="color:var(--text-faint)">No comments yet.</div></div>') +
            "</div>";
        var name = localStorage.getItem("readout_author") || "";
        pop.innerHTML =
            "<h4>Comments</h4>" +
            thread +
            '<p class="err" style="display:none"></p>' +
            '<input class="cmt-name" maxlength="80" placeholder="Your name" value="' +
            esc(name) +
            '" />' +
            '<textarea class="cmt-body" maxlength="4000" placeholder="Leave a comment"></textarea>' +
            '<div class="row"><button class="ghost cmt-cancel">Cancel</button><button class="cmt-send">Comment</button></div>';
        document.body.appendChild(pop);
        position(pop, block);
        openPop = pop;

        var bodyEl = pop.querySelector(".cmt-body");
        var nameEl = pop.querySelector(".cmt-name");
        var errEl = pop.querySelector(".err");
        bodyEl.focus();
        pop.querySelector(".cmt-cancel").onclick = close;
        pop.querySelector(".cmt-send").onclick = function () {
            var author = nameEl.value.trim();
            var body = bodyEl.value.trim();
            errEl.style.display = "none";
            if (!author || !body) {
                errEl.textContent = "Name and comment are both required.";
                errEl.style.display = "block";
                return;
            }
            localStorage.setItem("readout_author", author);
            var btn = pop.querySelector(".cmt-send");
            btn.disabled = true;
            var prev = btn.textContent;
            btn.textContent = "Sending";
            post(anchor, author, body)
                .then(function (saved) {
                    (byAnchor[anchor] = byAnchor[anchor] || []).push(saved);
                    markPin(pin, byAnchor[anchor].length);
                    openThread(block, anchor, pin); // reopen with the refreshed thread
                })
                .catch(function () {
                    btn.disabled = false;
                    btn.textContent = prev;
                    errEl.textContent = "Could not post — check your connection and retry.";
                    errEl.style.display = "block";
                });
        };
    }

    function position(pop, block) {
        var r = block.getBoundingClientRect();
        var top = window.scrollY + r.top;
        var left = window.scrollX + r.right + 16;
        if (left + 300 > window.scrollX + window.innerWidth)
            left = window.scrollX + Math.max(12, r.right - 300);
        pop.style.top = top + "px";
        pop.style.left = left + "px";
    }

    function markPin(pin, count) {
        if (count > 0) {
            pin.classList.add("has");
            pin.textContent = String(count);
        } else {
            pin.classList.remove("has");
            pin.textContent = "+";
        }
    }

    function attach() {
        var blocks = document.querySelectorAll("[data-anchor]");
        Array.prototype.forEach.call(blocks, function (block) {
            var anchor = block.getAttribute("data-anchor");
            if (!anchor) return;
            var pin = document.createElement("div");
            pin.className = "cmt-pin";
            pin.textContent = "+";
            pin.title = "Comment on this block";
            pin.onclick = function (e) {
                e.stopPropagation();
                openThread(block, anchor, pin);
            };
            block.appendChild(pin);
            var existing = (byAnchor[anchor] || []).length;
            if (existing) markPin(pin, existing);
        });
    }

    injectStyle();
    fetchAll()
        .then(function (rows) {
            rows.forEach(function (c) {
                (byAnchor[c.anchor_id] = byAnchor[c.anchor_id] || []).push(c);
            });
        })
        .catch(function () {})
        .then(attach);
})();
