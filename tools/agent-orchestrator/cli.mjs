#!/usr/bin/env node
import { runSafeTrial } from './trial.mjs'

const [command, ...args] = process.argv.slice(2)

if (command !== 'trial') {
  console.error('Usage: node tools/agent-orchestrator/cli.mjs trial [--keep]')
  process.exitCode = 1
} else {
  const keep = args.includes('--keep')
  let trial
  try {
    trial = await runSafeTrial({
      keep,
      canonicalRoot: process.cwd(),
      preservedPaths: ['components/app/BottomTabBar.tsx', 'docs/mac-handoff-checklist.md', 'supabase/.temp/'],
    })
    console.log(JSON.stringify({
      status: trial.status,
      candidateId: trial.state.candidateId,
      correctionRounds: trial.state.correctionRounds,
      identities: trial.state.agentRegistry.identities,
      changedPaths: trial.changedPaths,
      stagedPaths: trial.stagedPaths,
      remotes: trial.remotes,
      workspaceRoot: keep ? trial.workspaceRoot : '(disposed after verification)',
    }, null, 2))
    if (trial.status !== 'READY_FOR_HANDOFF') process.exitCode = 1
  } finally {
    if (trial && !keep) trial.dispose()
  }
}
