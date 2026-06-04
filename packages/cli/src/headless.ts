import type { KernelHost } from '@bobby/kernel';

export async function runHeadless(
  host: KernelHost,
  input: string
): Promise<{ exitCode: number; status: string }> {
  let status = 'failed';

  const unsubscribe = host.subscribe((event) => {
    if (event.type === 'final_result') {
      status = event.status;
    }
  });

  try {
    await host.send({ type: 'startTask', input });
  } finally {
    unsubscribe();
  }

  return {
    exitCode: status === 'done' ? 0 : 1,
    status
  };
}
