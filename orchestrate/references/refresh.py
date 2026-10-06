#!/usr/bin/env python3
"""sync model-map.md from the canonical model map.

the canonical map is a separate project (artificial analysis, design arena and
arena.ai sources, its own .venv); this skill bundles a copy of its generated
model-map.md so the routing reference works without it. never hand-edit the copy.

usage: ./refresh.py            # copy the canonical model-map.md over the bundled one
       ./refresh.py --fetch    # run the canonical refresh first, then copy
canonical dir: $MODEL_MAP_DIR, else ~/git/ccChat-general/claude/model-map
"""

import os
import pathlib
import subprocess
import sys

HERE = pathlib.Path(__file__).parent
DOC = HERE / "model-map.md"
SOURCE = pathlib.Path(os.environ.get(
    "MODEL_MAP_DIR", pathlib.Path.home() / "git/ccChat-general/claude/model-map"))

HEADER = """# model map

Bundled copy of the canonical model map, synced by `./refresh.py` in this folder; do not edit it
here, the next sync overwrites it. Which model at which reasoning effort, judged on what it costs
to finish a task rather than on price per token. Data comes from Artificial Analysis, Design Arena
and Arena.ai.
"""


def main():
    canonical = SOURCE / "model-map.md"
    if not canonical.exists():
        raise SystemExit(f"no canonical map at {canonical}: set $MODEL_MAP_DIR")

    if "--fetch" in sys.argv:
        venv = SOURCE / ".venv/bin/python"
        python = str(venv) if venv.exists() else sys.executable
        subprocess.run([python, "refresh.py"], cwd=SOURCE, check=True)

    # drop the canonical title and intro paragraph, which describe its own folder
    text = canonical.read_text()
    _, _, body = text.partition("\n## ")
    if not body:
        raise SystemExit(f"unexpected layout in {canonical}: no second-level heading")
    DOC.write_text(HEADER + "\n## " + body)
    print(f"wrote {DOC} from {canonical}")


if __name__ == "__main__":
    main()
