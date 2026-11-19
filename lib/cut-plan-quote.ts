export type CutPlanQuotePrefill = {
  service: string;
  details: string;
  internalNotes: string;
  item: {
    description: string;
    serviceType: "laser" | "router_cnc";
    material: string;
    quantity: string;
    unit: string;
    unitCost: string;
    unitPrice: string;
    productionNotes: string;
    machineId: string;
    machineMinutes: string;
    desiredMarginPercent: string;
  };
};
