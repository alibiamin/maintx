#!/usr/bin/env node
/**
 * Lance backend et frontend en parallèle (sans dépendance à concurrently).
 * Usage: node dev-runner.js
 */
const path = require('path');
const { spawn } = require('child_process');

const root = __dirname;
const colors = { back: '\x1b[34m', front: '\x1b[32m', reset: '\x1b[0m' };

function run(name, cmd, args, cwd) {
  const c = colors[name] || '';
  const child = spawn(cmd, args, {
    cwd: path.join(root, cwd),
    stdio: ['ignore', 'pipe', 'pipe']
  });
  child.stdout.on('data', (d) => process.stdout.write(`${c}[${name}] ${d}${colors.reset}`));
  child.stderr.on('data', (d) => process.stderr.write(`${c}[${name}] ${d}${colors.reset}`));
  child.on('error', (err) => console.error(`[${name}] error:`, err));
  child.on('exit', (code) => code !== null && code !== 0 && process.exit(code));
  return child;
}

console.log('Starting backend and frontend...\n');
run('back', process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'dev'], 'backend');
run('front', process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'dev'], 'frontend');
