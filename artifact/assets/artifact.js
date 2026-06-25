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
    loadScript("https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js", function () {
        if (!window.mermaid) return;
        var bg = cssVar("--bg", "#16120D");
        var surface = cssVar("--surface", "#1F1A13");
        var surface2 = cssVar("--surface-2", "#241E16");
        var accent = cssVar("--accent", "#E0A85B");
        var accentDim = cssVar("--accent-dim", "#B98842");
        var text = cssVar("--text", "#F4EFE6");
        var textStrong = cssVar("--text-strong", "#FBF7EF");
        var hairline = cssVar("--hairline", "#352C20");
        window.mermaid.initialize({
            startOnLoad: false,
            theme: "base",
            fontFamily: cssVar("--sans", "Inter, system-ui, sans-serif"),
            // roomier layout so diagrams read well once CSS scales them
            // up to fill the column (see .diagram .mermaid svg in the theme)
            flowchart: { nodeSpacing: 45, rankSpacing: 55, padding: 14 },
            themeVariables: {
                darkMode: true,
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
    });

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
})();
