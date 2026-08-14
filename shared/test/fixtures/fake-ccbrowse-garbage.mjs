#!/usr/bin/env node
// stand-in for a ccbrowse CLI whose stdout is not JSON.
process.stdout.write('Traceback (most recent call last):\n  sqlite3.OperationalError\n');
