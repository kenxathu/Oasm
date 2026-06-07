import { describe, expect, it } from 'vitest';

import { buildWorkerCommand } from './worker-command';

describe('buildWorkerCommand', () => {
  it('builds the local task command with worker replicas and max jobs', () => {
    expect(
      buildWorkerCommand({
        apiKey: 'workspace-key',
        maxJobs: 12,
        networkId: 'network-1',
        replicas: 4,
      }),
    ).toBe(
      'task worker:dev replicas=4 maxJobs=12 apiKey=workspace-key network=network-1',
    );
  });

  it('builds the local task command without an internal network', () => {
    expect(
      buildWorkerCommand({
        apiKey: 'workspace-key',
        maxJobs: 6,
        replicas: 3,
      }),
    ).toBe('task worker:dev replicas=3 maxJobs=6 apiKey=workspace-key');
  });
});
