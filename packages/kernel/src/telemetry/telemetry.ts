export class Telemetry {
  constructor(
    private cfg: { enabled: boolean },
    private sink: (event: string) => void
  ) {}

  track(event: string): void {
    if (!this.cfg.enabled) {
      return;
    }

    this.sink(event);
  }
}
