/**
 * Branch-based RLS test runner for CI / pre-merge validation.
 *
 * Creates an ephemeral Supabase preview branch, runs RLS tests against it,
 * then deletes the branch (always, even on failure).
 *
 * Usage:
 *   npm run test:rls                # create branch → test → delete
 *   npm run test:rls:local          # skip branching, use local/cloud .env
 *
 * Requires:
 *   - Supabase CLI authenticated (`supabase login`)
 *   - SUPABASE_PROJECT_REF env var or .env with it
 */

import { execSync, spawn } from 'node:child_process';
import { config } from 'dotenv';

config(); // load .env

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF ?? 'yecivnczykkdhjjhydam';
const POLL_INTERVAL_MS = 10_000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

interface BranchCreateResult {
  id: string;
  name: string;
  project_ref: string;
  status: string;
}

interface BranchListItem {
  id: string;
  name: string;
  project_ref: string;
  status: string;
  preview_project_status: string;
}

interface BranchCredentials {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  POSTGRES_URL: string;
  POSTGRES_URL_NON_POOLING: string;
}

function cli(cmd: string): string {
  return execSync(cmd, { encoding: 'utf-8', timeout: 30_000 }).trim();
}

function parseJsonFromCli<T>(raw: string): T {
  // `branches create` prefixes output with "Created preview branch:\n"
  const jsonStart = raw.indexOf('{');
  const jsonEnd = raw.lastIndexOf('}');
  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error(`No JSON object found in CLI output:\n${raw}`);
  }
  return JSON.parse(raw.slice(jsonStart, jsonEnd + 1)) as T;
}

function createBranch(): BranchCreateResult {
  const name = `rls-test-${Date.now()}`;
  console.log(`Creating preview branch "${name}"...`);
  const raw = cli(
    `supabase branches create ${name} --project-ref ${PROJECT_REF} -o json`,
  );
  return parseJsonFromCli<BranchCreateResult>(raw);
}

async function waitForBranch(branchId: string): Promise<void> {
  const start = Date.now();
  console.log('Waiting for branch to become ACTIVE_HEALTHY...');

  while (Date.now() - start < POLL_TIMEOUT_MS) {
    const raw = cli(
      `supabase branches list --project-ref ${PROJECT_REF} -o json`,
    );
    const branches: BranchListItem[] = JSON.parse(raw);
    const branch = branches.find((b) => b.id === branchId);

    if (!branch) {
      throw new Error(`Branch ${branchId} not found in branches list`);
    }

    const elapsed = Math.round((Date.now() - start) / 1000);
    console.log(
      `  [${elapsed}s] status=${branch.status} preview=${branch.preview_project_status}`,
    );

    if (branch.preview_project_status === 'ACTIVE_HEALTHY') {
      return;
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  throw new Error(`Branch did not become ACTIVE_HEALTHY within ${POLL_TIMEOUT_MS / 1000}s`);
}

function getBranchCredentials(branchId: string): BranchCredentials {
  console.log('Fetching branch credentials...');
  const raw = cli(
    `supabase branches get ${branchId} --project-ref ${PROJECT_REF} -o json`,
  );
  return JSON.parse(raw) as BranchCredentials;
}

function runVitest(env: Record<string, string>): Promise<number> {
  return new Promise((resolve) => {
    console.log('\nRunning RLS tests...\n');

    const child = spawn('npx', ['vitest', 'run', '--config', 'vitest.config.ts'], {
      stdio: 'inherit',
      env: { ...process.env, ...env },
      cwd: process.cwd(),
    });

    child.on('close', (code) => resolve(code ?? 1));
    child.on('error', (err) => {
      console.error('Failed to start vitest:', err.message);
      resolve(1);
    });
  });
}

function deleteBranch(branchId: string): void {
  console.log(`\nDeleting preview branch ${branchId}...`);
  try {
    cli(
      `supabase branches delete ${branchId} --project-ref ${PROJECT_REF} --yes`,
    );
    console.log('Branch deleted.');
  } catch (err) {
    console.error('Warning: failed to delete branch:', (err as Error).message);
  }
}

async function main(): Promise<void> {
  let branchId: string | undefined;
  let exitCode = 1;

  try {
    const branch = createBranch();
    branchId = branch.id;
    console.log(`Branch created: id=${branch.id} ref=${branch.project_ref}`);

    await waitForBranch(branch.id);

    const creds = getBranchCredentials(branch.id);
    console.log(`Branch URL: ${creds.SUPABASE_URL}`);

    exitCode = await runVitest({
      SUPABASE_URL: creds.SUPABASE_URL,
      SUPABASE_ANON_KEY: creds.SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: creds.SUPABASE_SERVICE_ROLE_KEY,
      DATABASE_URL: creds.POSTGRES_URL_NON_POOLING,
    });
  } finally {
    if (branchId) {
      deleteBranch(branchId);
    }
  }

  process.exit(exitCode);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
