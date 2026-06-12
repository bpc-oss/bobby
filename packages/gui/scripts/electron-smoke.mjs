import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import electronPath from 'electron';

const requiredMethods = [
  'send',
  'getSetupStatus',
  'selectProject',
  'listWorkspaceTree',
  'readWorkspaceFile',
  'runTerminalCommand',
  'startPreviewServer',
  'listCommands',
  'listAutomations',
  'listMcpServers',
  'dispatchSubAgent'
];

const child = spawn(electronPath, ['.'], {
  cwd: new URL('..', import.meta.url),
  env: {
    ...process.env,
    BOBBY_ELECTRON_SMOKE: '1',
    BOBBY_ELECTRON_SMOKE_PROJECT: fileURLToPath(new URL('../../..', import.meta.url)),
    BOBBY_AUTOMATION_RUN_TIMEOUT_MS: process.env.BOBBY_AUTOMATION_RUN_TIMEOUT_MS ?? '3000'
  },
  stdio: ['ignore', 'pipe', 'pipe']
});

let stdout = '';
let stderr = '';

child.stdout.setEncoding('utf8');
child.stderr.setEncoding('utf8');
child.stdout.on('data', (chunk) => {
  stdout += chunk;
  process.stdout.write(chunk);
});
child.stderr.on('data', (chunk) => {
  stderr += chunk;
  process.stderr.write(chunk);
});

const timeout = setTimeout(() => {
  child.kill();
  console.error('Electron smoke timed out before the renderer bridge was verified.');
  process.exit(1);
}, 30_000);

child.on('exit', (code) => {
  clearTimeout(timeout);

  const line = stdout.split(/\r?\n/).find((entry) => entry.startsWith('BOBBY_ELECTRON_SMOKE '));
  if (!line) {
    console.error('Electron smoke did not emit BOBBY_ELECTRON_SMOKE output.');
    if (stderr.trim()) {
      console.error(stderr.trim());
    }
    process.exit(1);
  }

  const result = JSON.parse(line.slice('BOBBY_ELECTRON_SMOKE '.length));
  const missing = requiredMethods.filter((method) => !result.methods.includes(method));
  const terminalOk = result.terminalExitCode === 0 && result.terminalStdout === 'bobby-electron-smoke';
  const projectOk = typeof result.selectedProject === 'string' && result.selectedProject.length > 0;
  const fixtureOk = typeof result.fixtureProject === 'string' && result.fixtureProject.length > 0;
  const filesOk = result.treeCount > 0 && result.packageJsonBytes > 0;
  const sessionOk = result.sessionRoundTrip === true;
  const snapshotOk = result.snapshotRoundTrip === true;
  const proposalOk = result.proposalApplyRoundTrip === true;
  const agentOk = result.agentRoundTrip === true;
  const commandOk = result.commandRoundTrip === true;
  const automationOk = result.automationRoundTrip === true;
  const automationRunNowOk = result.automationRunNowRoundTrip === true;
  const mcpOk = result.mcpServerCount > 0;
  if (
    code !== 0 ||
    !result.hasBobbyBridge ||
    missing.length > 0 ||
    !terminalOk ||
    !projectOk ||
    !fixtureOk ||
    !filesOk ||
    !sessionOk ||
    !snapshotOk ||
    !proposalOk ||
    !agentOk ||
    !commandOk ||
    !automationOk ||
    !automationRunNowOk ||
    !mcpOk
  ) {
    console.error(`Electron smoke failed: ${JSON.stringify({
      code,
      hasBobbyBridge: result.hasBobbyBridge,
      missing,
      selectedProject: result.selectedProject,
      fixtureProject: result.fixtureProject,
      treeCount: result.treeCount,
      packageJsonBytes: result.packageJsonBytes,
      terminalExitCode: result.terminalExitCode,
      terminalStdout: result.terminalStdout,
      sessionRoundTrip: result.sessionRoundTrip,
      snapshotRoundTrip: result.snapshotRoundTrip,
      proposalApplyRoundTrip: result.proposalApplyRoundTrip,
      proposalApplyDetails: result.proposalApplyDetails,
      agentRoundTrip: result.agentRoundTrip,
      commandRoundTrip: result.commandRoundTrip,
      automationRoundTrip: result.automationRoundTrip,
      automationRunNowRoundTrip: result.automationRunNowRoundTrip,
      mcpServerCount: result.mcpServerCount
    })}`);
    process.exit(1);
  }

  console.log(`Electron smoke verified ${result.methods.length} bridge methods, workspace files, terminal IPC, sessions, snapshots, proposals, agents, commands, automations, and MCP list.`);
});
