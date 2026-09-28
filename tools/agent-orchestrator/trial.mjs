import { execFileSync } from 'node:child_process'
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { FakeAgentAdapter } from './agents.mjs'
import { Coordinator } from './coordinator.mjs'
import { FakeValidationAdapter } from './validation.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const fixtureRoot = resolve(here, 'fixtures', 'trial')

function git(root, args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true }).trim()
}

export async function runSafeTrial({ parentDirectory = tmpdir(), keep = false, canonicalRoot, preservedPaths = [] } = {}) {
  const container = mkdtempSync(resolve(parentDirectory, 'mpp-aos-004a-trial-'))
  const dispose = () => rmSync(container, { recursive: true, force: true, maxRetries: 10, retryDelay: 25 })
  try {
    const workspaceRoot = resolve(container, 'workspace')
    const runDirectory = resolve(container, 'run-state')
    const artifactDirectory = resolve(container, 'artifacts')
    mkdirSync(workspaceRoot, { recursive: true })
    cpSync(resolve(fixtureRoot, 'README.md'), resolve(workspaceRoot, 'README.md'))
    git(workspaceRoot, ['init', '--quiet'])
    git(workspaceRoot, ['config', 'core.autocrlf', 'false'])
    git(workspaceRoot, ['config', 'user.name', 'AOS Synthetic Fixture'])
    git(workspaceRoot, ['config', 'user.email', 'aos-fixture@example.invalid'])
    git(workspaceRoot, ['add', '--', 'README.md'])
    git(workspaceRoot, ['commit', '--quiet', '-m', 'fixture: establish synthetic base'])
    const baseCommit = git(workspaceRoot, ['rev-parse', 'HEAD'])
    const packet = { ...JSON.parse(readFileSync(resolve(fixtureRoot, 'task-packet.json'), 'utf8')), baseCommit }
    const agentAdapter = new FakeAgentAdapter({
      implementer: [{
        kind: 'implementation', result: 'pass', evidence: ['wording-change-proposal'],
        candidate: { operations: [{
          type: 'write', path: 'README.md',
          content: '# Synthetic protocol fixture\n\nThis disposable fixture proves one harmless wording change.\n',
        }] },
      }],
      reviewer: [({ candidateId }) => ({
        kind: 'review', result: 'pass', candidateId, evidence: ['independent-review-pass'], findings: [],
      })],
    })
    const validationAdapter = new FakeValidationAdapter({
      'trial-focused': { result: 'pass', details: 'One synthetic focused assertion passed.' },
      'trial-build': { result: 'not_required', details: 'Approved nonfunctional fixture reason.' },
      'trial-browser': { result: 'not_required', details: 'Approved nonfunctional fixture reason.' },
    })
    const coordinator = new Coordinator({
      packet, workspaceRoot, runDirectory, artifactDirectory, agentAdapter, validationAdapter,
      integrityContext: { canonicalRoot, preservedPaths },
    })
    const result = await coordinator.run()
    const staged = git(workspaceRoot, ['diff', '--cached', '--name-only'])
    const changed = git(workspaceRoot, ['diff', '--name-only'])
    const remotes = git(workspaceRoot, ['remote'])
    return {
      ...result,
      workspaceRoot,
      runDirectory,
      artifactDirectory,
      stagedPaths: staged ? staged.split(/\r?\n/) : [],
      changedPaths: changed ? changed.split(/\r?\n/) : [],
      remotes: remotes ? remotes.split(/\r?\n/) : [],
      dispose,
    }
  } catch (error) {
    if (!keep) dispose()
    throw error
  }
}
