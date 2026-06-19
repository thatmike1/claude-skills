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

    // mermaid (UMD global) — warm-dark theme matched to style.css. render
    // explicitly with run() so it never depends on load-event timing.
    loadScript("https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js", function () {
        if (!window.mermaid) return;
        window.mermaid.initialize({
            startOnLoad: false,
            theme: "base",
            fontFamily: "Inter, system-ui, sans-serif",
            themeVariables: {
                darkMode: true,
                background: "#1F1A13",
                primaryColor: "#241E16",
                primaryBorderColor: "#E0A85B",
                primaryTextColor: "#F4EFE6",
                secondaryColor: "#241E16",
                tertiaryColor: "#1F1A13",
                lineColor: "#E0A85B",
                edgeLabelBackground: "#16120D",
                clusterBkg: "#1F1A13",
                clusterBorder: "#352C20",
                titleColor: "#FBF7EF",
                nodeBorder: "#B98842",
                nodeTextColor: "#F4EFE6",
                mainBkg: "#241E16",
                fontSize: "15px",
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
