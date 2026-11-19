/// <reference lib="webworker" />

import { createCutPlan, type CutPart } from "@/lib/cut-plan";

type WorkerRequest = {
  parts: CutPart[];
  options: Parameters<typeof createCutPlan>[1];
};

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  try {
    const plan = createCutPlan(event.data.parts, event.data.options);
    self.postMessage({ ok: true, plan });
  } catch (error) {
    self.postMessage({ ok: false, error: error instanceof Error ? error.message : "Não foi possível calcular o encaixe." });
  }
};

export {};
