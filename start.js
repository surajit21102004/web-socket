const { spawn } = require('child_process');
const path = require('path');

console.log('\x1b[35m[ChatSync] Starting backend and frontend services...\x1b[0m');

function runService(name, command, args, cwd, color) {
  const proc = spawn(command, args, { cwd, shell: true });

  proc.stdout.on('data', (data) => {
    const lines = data.toString().split('\n');
    lines.forEach(line => {
      const cleanLine = line.replace(/[\r\n]+/g, '');
      if (cleanLine.trim()) {
        console.log(`${color}[${name}]\x1b[0m ${cleanLine}`);
      }
    });
  });

  proc.stderr.on('data', (data) => {
    const lines = data.toString().split('\n');
    lines.forEach(line => {
      const cleanLine = line.replace(/[\r\n]+/g, '');
      if (cleanLine.trim()) {
        console.error(`\x1b[31m[${name} ERROR]\x1b[0m ${cleanLine}`);
      }
    });
  });

  proc.on('close', (code) => {
    console.log(`${color}[${name}]\x1b[0m exited with code ${code}`);
  });

  return proc;
}

const backendProcess = runService('Backend', 'npm', ['start'], path.join(__dirname, 'backend'), '\x1b[32m');
const frontendProcess = runService('Frontend', 'npm', ['run', 'dev'], path.join(__dirname, 'frontend'), '\x1b[36m');

process.on('SIGINT', () => {
  console.log('\n\x1b[35m[ChatSync] Shutting down services...\x1b[0m');
  backendProcess.kill();
  frontendProcess.kill();
  process.exit();
});
