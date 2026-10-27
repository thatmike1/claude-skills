/**
 * shared runtime for session artifacts: code highlighting, mermaid diagrams,
 * and interactive tables (click-to-sort + row filter).
 *
 * deliberately a CLASSIC script (not an ES module): artifacts are opened
 * straight from disk over file://, and module scripts are blocked there by
 * CORS. classic scripts — including the CDN ones injected below — load fine.
 */
(function () {
    function loadScript(src, onload) {
        var s = document.createElement("script");
        s.src = src;
        s.onload = onload || null;
        s.onerror = function () {
            console.warn("artifact: failed to load " + src);
        };
        document.head.appendChild(s);
    }

    // highlight.js — the common bundle already covers typescript, js, json,
    // bash, sql, etc.
    loadScript(
        "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js",
        function () {
            if (window.hljs) window.hljs.highlightAll();
        }
    );

    // mermaid (UMD global) — themed from the active stylesheet's CSS custom
    // properties so the diagram matches whichever theme is loaded (editorial /
    // dossier / terminal / brutalist), with editorial defaults as fallback.
    // render explicitly with run() so it never depends on load-event timing.
    function cssVar(name, fallback) {
        var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
        return v || fallback;
    }

    // cached diagram sources: mermaid replaces each .mermaid node's text with an
    // SVG on first run, so we stash the original source to re-render on a theme
    // flip. filled once mermaid loads.
    var mermaidSources = [];

    // initialise mermaid from the *current* CSS custom properties and render
    // every .mermaid node. re-callable: reads fresh vars each time so a theme
    // toggle re-themes the diagrams.
    function initMermaid() {
        if (!window.mermaid) return;
        var bg = cssVar("--bg", "#16120D");
        var surface = cssVar("--surface", "#1F1A13");
        var surface2 = cssVar("--surface-2", "#241E16");
        var accent = cssVar("--accent", "#E0A85B");
        var accentDim = cssVar("--accent-dim", "#B98842");
        var text = cssVar("--text", "#F4EFE6");
        var textStrong = cssVar("--text-strong", "#FBF7EF");
        var hairline = cssVar("--hairline", "#352C20");
        var isDark =
            (document.documentElement.dataset.theme ||
                (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
                    ? "dark"
                    : "light")) !== "light";
        window.mermaid.initialize({
            startOnLoad: false,
            theme: "base",
            fontFamily: cssVar("--sans", "Inter, system-ui, sans-serif"),
            // roomier layout so diagrams read well once CSS scales them
            // up to fill the column (see .diagram .mermaid svg in the theme)
            flowchart: { nodeSpacing: 45, rankSpacing: 55, padding: 14 },
            themeVariables: {
                darkMode: isDark,
                background: bg,
                primaryColor: surface2,
                primaryBorderColor: accent,
                primaryTextColor: text,
                secondaryColor: surface2,
                tertiaryColor: surface,
                lineColor: accent,
                edgeLabelBackground: bg,
                clusterBkg: surface,
                clusterBorder: hairline,
                titleColor: textStrong,
                nodeBorder: accentDim,
                nodeTextColor: text,
                mainBkg: surface2,
                fontSize: "16px",
            },
        });
        try {
            window.mermaid.run({ querySelector: ".mermaid" });
        } catch (e) {
            console.warn("artifact: mermaid render failed", e);
        }
    }

    loadScript("https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js", function () {
        if (!window.mermaid) return;
        // cache each diagram's source before the first run rewrites it to SVG.
        Array.prototype.slice.call(document.querySelectorAll(".mermaid")).forEach(function (node) {
            mermaidSources.push({ node: node, src: node.textContent });
        });
        initMermaid();
    });

    // re-render every diagram from its cached source (used after a theme flip).
    function reRenderMermaid() {
        if (!window.mermaid || !mermaidSources.length) return;
        mermaidSources.forEach(function (entry) {
            entry.node.textContent = entry.src;
            entry.node.removeAttribute("data-processed");
        });
        initMermaid();
    }

    // header theme toggle — flips data-theme (seeding from prefers-color-scheme
    // when unset), persists it, and re-themes the diagrams. diff blocks and
    // tables follow color-scheme via CSS, so they need no JS here.
    function activeTheme() {
        var t = document.documentElement.dataset.theme;
        if (t === "light" || t === "dark") return t;
        return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light";
    }

    var themeToggle = document.querySelector("button.theme-toggle");
    if (themeToggle) {
        themeToggle.addEventListener("click", function () {
            var next = activeTheme() === "dark" ? "light" : "dark";
            document.documentElement.dataset.theme = next;
            try {
                localStorage.setItem("readout-theme", next);
            } catch (e) {}
            reRenderMermaid();
        });
    }

    // interactive tables — no deps. add class "sortable" to a <table> for
    // click-to-sort headers (mark a column <th data-nosort> to skip it); add
    // data-filter="placeholder" to a .tablewrap for a live row filter.
    function cellValue(row, i) {
        var c = row.children[i];
        return c ? c.textContent.trim() : "";
    }

    function sortBy(table, headers, th, i) {
        var asc = th.getAttribute("aria-sort") !== "ascending";
        headers.forEach(function (h) {
            h.removeAttribute("aria-sort");
        });
        th.setAttribute("aria-sort", asc ? "ascending" : "descending");
        var body = table.tBodies[0];
        if (!body) return;
        Array.prototype.slice
            .call(body.rows)
            .sort(function (a, b) {
                var x = cellValue(a, i);
                var y = cellValue(b, i);
                var nx = parseFloat(x.replace(/[^0-9.\-]/g, ""));
                var ny = parseFloat(y.replace(/[^0-9.\-]/g, ""));
                var bothNum = x !== "" && y !== "" && !isNaN(nx) && !isNaN(ny);
                var cmp = bothNum ? nx - ny : x.localeCompare(y, undefined, { numeric: true });
                return asc ? cmp : -cmp;
            })
            .forEach(function (r) {
                body.appendChild(r);
            });
    }

    function enhanceTables() {
        document.querySelectorAll("table.sortable").forEach(function (table) {
            if (!table.tHead) return;
            var headers = Array.prototype.slice.call(table.tHead.rows[0].cells);
            headers.forEach(function (th, i) {
                if (th.hasAttribute("data-nosort")) return;
                th.addEventListener("click", function () {
                    sortBy(table, headers, th, i);
                });
            });
        });

        document.querySelectorAll(".tablewrap[data-filter]").forEach(function (wrap) {
            var table = wrap.querySelector("table");
            if (!table || !table.tBodies[0]) return;
            var input = document.createElement("input");
            input.type = "text";
            input.className = "table-filter";
            input.placeholder = wrap.getAttribute("data-filter") || "Filter…";
            wrap.parentNode.insertBefore(input, wrap);
            input.addEventListener("input", function () {
                var q = input.value.toLowerCase();
                Array.prototype.slice.call(table.tBodies[0].rows).forEach(function (row) {
                    row.style.display =
                        row.textContent.toLowerCase().indexOf(q) !== -1 ? "" : "none";
                });
            });
        });
    }

    enhanceTables();

    // docshelf — a document browser: click a file in the tree to swap the
    // visible pane, and an expand/collapse-all toggle per doc. no deps.
    function activateDoc(shelf, id) {
        var buttons = shelf.querySelectorAll(".ds-filebtn");
        Array.prototype.forEach.call(buttons, function (btn) {
            var on = btn.getAttribute("data-ds-target") === id;
            btn.classList.toggle("active", on);
            btn.setAttribute("aria-selected", on ? "true" : "false");
        });
        var docs = shelf.querySelectorAll(".ds-doc");
        Array.prototype.forEach.call(docs, function (doc) {
            var on = doc.getAttribute("data-ds-id") === id;
            doc.classList.toggle("ds-hidden", !on);
            if (on) doc.removeAttribute("aria-hidden");
            else doc.setAttribute("aria-hidden", "true");
        });
    }

    // sync one doc's expand-all button label to whether any group is closed.
    function syncExpandLabel(doc) {
        var btn = doc.querySelector("[data-ds-expand]");
        if (!btn) return;
        var groups = doc.querySelectorAll("details.ds-group");
        if (!groups.length) {
            btn.style.display = "none";
            return;
        }
        var anyClosed = Array.prototype.some.call(groups, function (g) {
            return !g.open;
        });
        btn.textContent = anyClosed ? "Expand all" : "Collapse all";
    }

    function enhanceDocShelves() {
        document.querySelectorAll("[data-ds-shelf]").forEach(function (shelf) {
            shelf.querySelectorAll(".ds-filebtn").forEach(function (btn) {
                btn.addEventListener("click", function () {
                    activateDoc(shelf, btn.getAttribute("data-ds-target"));
                });
            });
            shelf.querySelectorAll(".ds-doc").forEach(function (doc) {
                syncExpandLabel(doc);
                var btn = doc.querySelector("[data-ds-expand]");
                if (btn) {
                    btn.addEventListener("click", function () {
                        var groups = doc.querySelectorAll("details.ds-group");
                        var expand = Array.prototype.some.call(groups, function (g) {
                            return !g.open;
                        });
                        Array.prototype.forEach.call(groups, function (g) {
                            g.open = expand;
                        });
                        syncExpandLabel(doc);
                    });
                }
                doc.querySelectorAll("details.ds-group").forEach(function (g) {
                    g.addEventListener("toggle", function () {
                        syncExpandLabel(doc);
                    });
                });
            });
        });
    }

    enhanceDocShelves();

    // interactive checklists — upgrade each authored li.check into a real
    // toggleable checkbox. the authored `done` class is the default; a viewer's
    // toggle overrides it and persists per document + item in localStorage, so
    // "verify these" checklists actually hold their ticks across reloads. pure
    // progressive enhancement: no-JS pages keep the static rendering.
    function checkKey(s) {
        // djb2 → base36, stable per item text so reordering doesn't scramble state
        var h = 5381,
            i = s.length;
        while (i) h = (h * 33) ^ s.charCodeAt(--i);
        return (h >>> 0).toString(36);
    }

    function enhanceChecklists() {
        var store;
        try {
            store = window.localStorage;
        } catch (e) {
            store = null;
        }
        var docKey = "readout-check:" + location.pathname + ":";
        document.querySelectorAll("ul.checklist").forEach(function (list) {
            var anchor = list.getAttribute("data-anchor") || "checklist";
            list.querySelectorAll("li.check").forEach(function (item) {
                var body = item.querySelector(".body");
                var text = (body ? body.textContent : item.textContent).trim();
                var key = docKey + anchor + ":" + checkKey(text);
                var saved = store ? store.getItem(key) : null;
                if (saved === "1") item.classList.add("done");
                else if (saved === "0") item.classList.remove("done");

                item.setAttribute("role", "checkbox");
                item.setAttribute("tabindex", "0");
                item.setAttribute(
                    "aria-checked",
                    item.classList.contains("done") ? "true" : "false"
                );

                function toggle() {
                    var done = !item.classList.contains("done");
                    item.classList.toggle("done", done);
                    item.setAttribute("aria-checked", done ? "true" : "false");
                    if (store) {
                        try {
                            store.setItem(key, done ? "1" : "0");
                        } catch (e) {}
                    }
                }

                item.addEventListener("click", function (e) {
                    // don't hijack clicks on links inside the item body
                    if (e.target.closest && e.target.closest("a")) return;
                    toggle();
                });
                item.addEventListener("keydown", function (e) {
                    if (e.key === " " || e.key === "Enter") {
                        e.preventDefault();
                        toggle();
                    }
                });
            });
        });
    }

    enhanceChecklists();

    // section rail — a fixed table-of-contents on the right margin that
    // scrollspy-highlights the section currently near the top of the viewport.
    // built from the page's <section data-anchor="s-…"> blocks; no compile step
    // and no deps. CSS hides it below the width where the margin has room.
    function escapeHtml(s) {
        var d = document.createElement("div");
        d.textContent = s == null ? "" : s;
        return d.innerHTML;
    }

    function buildSectionRail() {
        var page = document.querySelector("main.page");
        if (!page) return;
        var sections = Array.prototype.filter.call(page.children, function (el) {
            return (
                el.tagName === "SECTION" &&
                (el.getAttribute("data-anchor") || "").indexOf("s-") === 0
            );
        });
        if (sections.length < 2) return; // a single section isn't worth a rail

        var items = "";
        sections.forEach(function (sec) {
            if (!sec.id) sec.id = sec.getAttribute("data-anchor");
            var h2 = sec.querySelector("h2");
            var title = "";
            if (h2) {
                var clone = h2.cloneNode(true);
                var marker = clone.querySelector(".marker");
                if (marker) marker.remove();
                title = clone.textContent.trim();
            }
            if (!title) return;
            items +=
                '<li><a href="#' +
                sec.id +
                '" data-toc="' +
                sec.id +
                '">' +
                escapeHtml(title) +
                "</a></li>";
        });

        var nav = document.createElement("nav");
        nav.className = "readout-toc";
        nav.setAttribute("aria-label", "On this readout");
        nav.innerHTML =
            '<p class="toc-head">On this readout</p><ul class="toc-list">' + items + "</ul>";
        document.body.appendChild(nav);

        var byId = {};
        Array.prototype.forEach.call(nav.querySelectorAll("a[data-toc]"), function (a) {
            byId[a.getAttribute("data-toc")] = a;
            // smooth scroll without leaving a #hash jump in history
            a.addEventListener("click", function (e) {
                var target = document.getElementById(a.getAttribute("data-toc"));
                if (!target) return;
                e.preventDefault();
                target.scrollIntoView({ behavior: "smooth", block: "start" });
            });
        });

        var current = null;
        function setActive(id) {
            if (id === current) return;
            if (current && byId[current]) byId[current].classList.remove("active");
            current = id;
            if (byId[id]) byId[id].classList.add("active");
        }
        setActive(sections[0].id);

        // a section becomes active when it crosses into the top band of the
        // viewport; pick the topmost such section so the highlight tracks reading
        // position. keeps the last active when scrolled into the footer.
        var visible = {};
        var obs = new IntersectionObserver(
            function (entries) {
                entries.forEach(function (en) {
                    visible[en.target.id] = en.isIntersecting;
                });
                for (var i = 0; i < sections.length; i++) {
                    if (visible[sections[i].id]) {
                        setActive(sections[i].id);
                        return;
                    }
                }
            },
            { rootMargin: "-12% 0px -72% 0px", threshold: 0 }
        );
        sections.forEach(function (s) {
            obs.observe(s);
        });
    }

    buildSectionRail();
})();
