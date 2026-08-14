#!/usr/bin/env node
// stand-in for a ccbrowse CLI that dies, to exercise the fallback path.
process.stderr.write('boom: no such index\n');
process.exit(3);
