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

    // ---- encrypted mode (protected readouts) --------------------------------
    // a protected readout carries <meta name="readout-comments" content="encrypted">
    // inside its (decrypted) HTML. in that mode the public comments API must only
    // ever see ciphertext: bodies are AES-GCM encrypted and anchors HMAC-hashed
    // with keys derived from the readout password. the unlock shell stashed that
    // password in sessionStorage on unlock; without it we do NOT activate (no
    // pins) and NEVER post plaintext. crypto here mirrors scripts/protect.mjs
    // exactly (salt string, 600000 iterations, 512-bit split, HMAC anchors).
    var encMeta = document.querySelector('meta[name="readout-comments"][content="encrypted"]');
    var encrypted = !!encMeta;
    var password = null;
    if (encrypted) {
        try {
            password = sessionStorage.getItem("readout-pw:" + docId);
        } catch (e) {
            /* sessionStorage unavailable */
        }
        if (!password) return; // locked: no key in this tab — stay a clean document
    }
    // keys are expensive (PBKDF2); derive once and reuse the cached promise.
    var keysPromise = encrypted ? deriveCommentKeys(password, docId) : null;

    function b64enc(buf) {
        var b = new Uint8Array(buf),
            s = "";
        for (var i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
        return btoa(s);
    }
    function b64dec(str) {
        var bin = atob(str),
            out = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
        return out;
    }

    /** derive the AES (bodies) + HMAC (anchors) keys from password + docId. */
    function deriveCommentKeys(pw, doc) {
        var te = new TextEncoder();
        return crypto.subtle
            .importKey("raw", te.encode(pw), "PBKDF2", false, ["deriveBits"])
            .then(function (km) {
                return crypto.subtle.deriveBits(
                    {
                        name: "PBKDF2",
                        salt: te.encode("readout-comments|" + doc),
                        iterations: 600000,
                        hash: "SHA-256",
                    },
                    km,
                    512
                );
            })
            .then(function (bits) {
                var b = new Uint8Array(bits);
                return Promise.all([
                    crypto.subtle.importKey(
                        "raw",
                        b.slice(0, 32),
                        { name: "AES-GCM", length: 256 },
                        false,
                        ["encrypt", "decrypt"]
                    ),
                    crypto.subtle.importKey(
                        "raw",
                        b.slice(32, 64),
                        { name: "HMAC", hash: "SHA-256" },
                        false,
                        ["sign"]
                    ),
                ]);
            })
            .then(function (k) {
                return { aesKey: k[0], macKey: k[1] };
            });
    }

    /** encrypt a {author, body, anchor} payload into an {enc,iv,data} envelope. */
    function encryptComment(keys, payload) {
        var iv = crypto.getRandomValues(new Uint8Array(12));
        return crypto.subtle
            .encrypt(
                { name: "AES-GCM", iv: iv },
                keys.aesKey,
                new TextEncoder().encode(JSON.stringify(payload))
            )
            .then(function (ct) {
                return { enc: 1, iv: b64enc(iv), data: b64enc(ct) };
            });
    }

    /** decrypt an {enc,iv,data} envelope back to {author, body, anchor}. */
    function decryptComment(keys, env) {
        return crypto.subtle
            .decrypt({ name: "AES-GCM", iv: b64dec(env.iv) }, keys.aesKey, b64dec(env.data))
            .then(function (pt) {
                return JSON.parse(new TextDecoder().decode(pt));
            });
    }

    /** deterministic opaque anchor id "enc-<32 hex>" = HMAC(realAnchor). */
    function hashAnchor(keys, realAnchor) {
        return crypto.subtle
            .sign("HMAC", keys.macKey, new TextEncoder().encode(realAnchor))
            .then(function (sig) {
                var b = new Uint8Array(sig),
                    hex = "";
                for (var i = 0; i < b.length; i++) hex += b[i].toString(16).padStart(2, "0");
                return "enc-" + hex.slice(0, 32);
            });
    }

    /** whether a stored body is an encrypted-comment envelope. */
    function isEnvelope(body) {
        if (typeof body !== "string" || body[0] !== "{") return false;
        try {
            var o = JSON.parse(body);
            return o && o.enc === 1 && typeof o.iv === "string" && typeof o.data === "string";
        } catch (e) {
            return false;
        }
    }

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
            ".cmt-item .tag{font:600 .6rem/1 var(--sans);letter-spacing:.06em;text-transform:uppercase;",
            "color:var(--text-faint,#7e745c);border:1px solid var(--hairline,#3b3326);border-radius:3px;",
            "padding:.1rem .3rem;margin-left:.4rem;vertical-align:middle}",
            ".cmt-item .body{font:.85rem/1.5 var(--sans);color:var(--text,#e5dbc8);margin-top:.15rem;white-space:pre-wrap}",
            ".cmt-item.reply{margin-left:1rem;padding-left:.6rem;border-left:2px solid var(--hairline,#3b3326)}",
            ".cmt-item.resolved{opacity:.5}",
            ".cmt-item .cmt-reply{font:.68rem/1 var(--sans);color:var(--text-faint,#7e745c);",
            "background:none;border:none;padding:0;margin-top:.2rem;cursor:pointer;text-decoration:underline}",
            ".cmt-pop select{width:100%;box-sizing:border-box;background:var(--surface,#1d1914);",
            "border:1px solid var(--hairline,#3b3326);border-radius:4px;color:var(--text,#e5dbc8);",
            "font:.8rem/1.4 var(--sans);padding:.4rem .5rem;margin-bottom:.45rem}",
            ".cmt-replying{font:.72rem/1.4 var(--sans);color:var(--text-faint,#7e745c);margin:0 0 .45rem}",
            ".cmt-replying a{color:var(--accent,#c8553d);cursor:pointer}",
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

    /** POST a prepared row; resolves to the saved record, rejects on HTTP error. */
    function send(row) {
        return fetch(API, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify(row),
        }).then(function (r) {
            if (!r.ok) return Promise.reject(r);
            return r.json();
        });
    }

    /**
     * create one comment, resolving to a DISPLAY-ready record (real author/body/
     * anchor). in encrypted mode the wire row carries only ciphertext (body =
     * envelope, author = "enc", anchor_id = HMAC); audience/parent_id stay plain.
     */
    function post(anchor, author, body, audience, parentId) {
        if (!encrypted) {
            var row = {
                doc_id: docId,
                anchor_id: anchor,
                author: author,
                body: body,
                audience: audience,
            };
            if (parentId) row.parent_id = parentId;
            return send(row);
        }
        return keysPromise.then(function (keys) {
            return Promise.all([
                hashAnchor(keys, anchor),
                encryptComment(keys, { author: author, body: body, anchor: anchor }),
            ]).then(function (res) {
                var row = {
                    doc_id: docId,
                    anchor_id: res[0],
                    author: "enc",
                    body: JSON.stringify(res[1]),
                    audience: audience,
                };
                if (parentId) row.parent_id = parentId;
                return send(row).then(function (saved) {
                    // present the record locally in cleartext; the server kept ciphertext.
                    saved.author = author;
                    saved.body = body;
                    saved.anchor_id = anchor;
                    return saved;
                });
            });
        });
    }

    /**
     * normalise fetched rows for display. plaintext mode is identity; encrypted
     * mode decrypts each body, recovers the real anchor, and drops any record
     * that fails to decrypt (wrong/old password, or spam posted without the key).
     */
    function prepareRows(rows) {
        if (!encrypted) return Promise.resolve(rows);
        return keysPromise.then(function (keys) {
            return Promise.all(
                rows.map(function (c) {
                    if (!isEnvelope(c.body)) return null;
                    return decryptComment(keys, JSON.parse(c.body))
                        .then(function (p) {
                            c.author = p.author;
                            c.body = p.body;
                            c.anchor_id = p.anchor;
                            return c;
                        })
                        .catch(function () {
                            return null;
                        });
                })
            ).then(function (list) {
                return list.filter(Boolean);
            });
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

    /** one rendered comment row; replies get an indented modifier class. */
    function itemHtml(c, isReply) {
        var cls = "cmt-item" + (isReply ? " reply" : "") + (c.resolved ? " resolved" : "");
        var tags = "";
        if (c.audience === "human") tags += '<span class="tag">for human</span>';
        if (c.resolved) tags += '<span class="tag">resolved</span>';
        return (
            '<div class="' +
            cls +
            '"><div><span class="who">' +
            esc(c.author) +
            '</span><span class="when">' +
            fmt(c.created) +
            "</span>" +
            tags +
            '</div><div class="body">' +
            esc(c.body) +
            '</div><button class="cmt-reply" data-id="' +
            esc(c.id) +
            '" data-author="' +
            esc(c.author) +
            '">Reply</button></div>'
        );
    }

    /** flatten a thread into root/reply rows (replies attach under their parent). */
    function threadHtml(list) {
        var ids = {};
        list.forEach(function (c) {
            ids[c.id] = true;
        });
        var out = [];
        list.forEach(function (c) {
            if (c.parent_id && ids[c.parent_id]) return; // rendered under its parent
            out.push(itemHtml(c, false));
            list.forEach(function (r) {
                if (r.parent_id === c.id) out.push(itemHtml(r, true));
            });
        });
        return out.join("");
    }

    function openThread(block, anchor, pin) {
        close();
        var list = byAnchor[anchor] || [];
        var pop = document.createElement("div");
        pop.className = "cmt-pop";
        var thread =
            '<div class="cmt-thread">' +
            (list.length
                ? threadHtml(list)
                : '<div class="cmt-item"><div class="body" style="color:var(--text-faint)">No comments yet.</div></div>') +
            "</div>";
        var name = localStorage.getItem("readout_author") || "";
        var audience = localStorage.getItem("readout_audience") || "agent";
        pop.innerHTML =
            "<h4>Comments</h4>" +
            thread +
            '<p class="err" style="display:none"></p>' +
            '<p class="cmt-replying" style="display:none">Replying to <span class="to"></span> — <a class="cmt-unreply">cancel</a></p>' +
            '<input class="cmt-name" maxlength="80" placeholder="Your name" value="' +
            esc(name) +
            '" />' +
            '<select class="cmt-audience">' +
            '<option value="agent"' +
            (audience === "agent" ? " selected" : "") +
            ">For the agent</option>" +
            '<option value="human"' +
            (audience === "human" ? " selected" : "") +
            ">For a human</option>" +
            "</select>" +
            '<textarea class="cmt-body" maxlength="4000" placeholder="Leave a comment"></textarea>' +
            '<div class="row"><button class="ghost cmt-cancel">Cancel</button><button class="cmt-send">Comment</button></div>';
        document.body.appendChild(pop);
        position(pop, block);
        openPop = pop;

        var bodyEl = pop.querySelector(".cmt-body");
        var nameEl = pop.querySelector(".cmt-name");
        var errEl = pop.querySelector(".err");
        var audEl = pop.querySelector(".cmt-audience");
        var replyingEl = pop.querySelector(".cmt-replying");
        var replyTo = null;
        bodyEl.focus();
        pop.querySelector(".cmt-cancel").onclick = close;
        pop.querySelector(".cmt-unreply").onclick = function () {
            replyTo = null;
            replyingEl.style.display = "none";
        };
        Array.prototype.forEach.call(pop.querySelectorAll(".cmt-reply"), function (btn) {
            btn.onclick = function () {
                replyTo = btn.getAttribute("data-id");
                replyingEl.querySelector(".to").textContent = btn.getAttribute("data-author");
                replyingEl.style.display = "block";
                bodyEl.focus();
            };
        });
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
            localStorage.setItem("readout_audience", audEl.value);
            var btn = pop.querySelector(".cmt-send");
            btn.disabled = true;
            var prev = btn.textContent;
            btn.textContent = "Sending";
            post(anchor, author, body, audEl.value, replyTo)
                .then(function (saved) {
                    (byAnchor[anchor] = byAnchor[anchor] || []).push(saved);
                    markPin(pin, openCount(anchor));
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

    /** unresolved comments on an anchor — what the pin badge counts. */
    function openCount(anchor) {
        return (byAnchor[anchor] || []).filter(function (c) {
            return !c.resolved;
        }).length;
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
            var existing = openCount(anchor);
            if (existing) markPin(pin, existing);
        });
    }

    injectStyle();
    fetchAll()
        .then(prepareRows)
        .then(function (rows) {
            rows.forEach(function (c) {
                (byAnchor[c.anchor_id] = byAnchor[c.anchor_id] || []).push(c);
            });
        })
        .catch(function () {})
        .then(attach);
})();
