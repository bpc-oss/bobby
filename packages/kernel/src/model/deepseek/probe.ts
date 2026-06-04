export interface ProbeRaw {
  models: string[];
  toolCalling: boolean;
  jsonMode: boolean;
  fim: boolean;
  promptCaching: boolean;
  reasoningToggle: boolean;
  contextWindow: number;
}

export interface CapabilityReport {
  runnerModel: string;
  graderModel: string;
  useToolCalling: boolean;
  useJsonMode: boolean;
  useFim: boolean;
  useCaching: boolean;
  useReasoning: boolean;
  contextWindow: number;
}

export function buildCapabilityReport(raw: ProbeRaw): CapabilityReport {
  if (raw.models.length < 1) {
    throw new Error('ProbeRaw models must contain at least one model.');
  }

  const runnerModel = raw.models.find((model) => /flash/i.test(model)) ?? raw.models[0];
  const graderModel = raw.models.find((model) => /pro/i.test(model)) ?? raw.models[1] ?? runnerModel;

  return {
    runnerModel,
    graderModel,
    useToolCalling: raw.toolCalling,
    useJsonMode: raw.jsonMode,
    useFim: raw.fim,
    useCaching: raw.promptCaching,
    useReasoning: raw.reasoningToggle,
    contextWindow: raw.contextWindow
  };
}
