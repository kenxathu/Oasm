type BuildWorkerCommandOptions = {
  apiKey?: string;
  maxJobs: number;
  networkId?: string;
  replicas: number;
};

/**
 * Builds the local worker task command used by the worker management dialog.
 */
export function buildWorkerCommand({
  apiKey,
  maxJobs,
  networkId,
  replicas,
}: BuildWorkerCommandOptions) {
  const networkArg = networkId ? ` network=${networkId}` : '';

  return `task worker:dev replicas=${replicas} maxJobs=${maxJobs} apiKey=${apiKey ?? ''}${networkArg}`;
}
