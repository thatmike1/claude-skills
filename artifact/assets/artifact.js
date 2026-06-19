/**
 * shared runtime for session artifacts: code highlighting + mermaid diagrams.
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
    },
  );

  // mermaid (UMD global) — warm-dark theme matched to style.css. render
  // explicitly with run() so it never depends on load-event timing.
  loadScript(
    "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js",
    function () {
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
    },
  );
})();
