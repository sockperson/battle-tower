#!/usr/bin/env node
// free-port.js
// Attempts to find and kill any process listening on the given port (default 3000).
// WARNING: This force-kills processes and should only be used in local dev environments.

const { execSync } = require('child_process');
const port = process.env.PORT ? Number(process.env.PORT) : 3000;

function killOnWindows(pid) {
  try {
    execSync(`taskkill /PID ${pid} /F`);
    console.log(`Killed PID ${pid} on Windows`);
  } catch (e) {
    console.error('Failed to kill process on Windows:', e.message || e);
  }
}

function killOnPosix(pid) {
  try {
    process.kill(pid, 'SIGKILL');
    console.log(`Killed PID ${pid} on POSIX`);
  } catch (e) {
    console.error('Failed to kill process on POSIX:', e.message || e);
  }
}

function findPidWindows(port) {
  try {
    const out = execSync(`netstat -ano | findstr :${port}`).toString();
    const lines = out.trim().split(/\r?\n/).filter(Boolean);
    for (const line of lines) {
      const cols = line.trim().split(/\s+/);
      const pid = cols[cols.length - 1];
      if (pid && !isNaN(pid)) return Number(pid);
    }
  } catch (e) {
    // no-op
  }
  return null;
}

function findPidPosix(port) {
  try {
    const out = execSync(`lsof -i :${port} -t 2>/dev/null || true`).toString();
    const pid = out.trim().split(/\s+/)[0];
    if (pid) return Number(pid);
  } catch (e) {
    // no-op
  }
  return null;
}

function main() {
  console.log(`Checking for process on port ${port}...`);
  const isWindows = process.platform === 'win32';
  let pid = null;
  if (isWindows) pid = findPidWindows(port);
  else pid = findPidPosix(port);

  if (!pid) {
    console.log('No process found on port', port);
    return;
  }
  console.log('Found PID', pid, 'listening on port', port);
  if (isWindows) killOnWindows(pid);
  else killOnPosix(pid);
}

main();
