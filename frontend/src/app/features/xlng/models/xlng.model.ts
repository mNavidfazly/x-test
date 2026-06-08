export interface XlngPageResponse<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface XlngScenarioBase {
  id: string;
  name: string;
  description: string;
  state: string;
  timeWindowStart: string;
  timeWindowEnd: string;
  tags: string[];
  creationDate: string;
  creationUser: string;
}

export interface XlngVariationBase {
  id: string;
  name: string;
  description: string;
  state: string;
  amountScenarios: number;
  tags: string[];
  creationDate: string;
  creationUser: string;
}

export interface XlngVariationDetail extends XlngVariationBase {
  nSimulations: number;
  startDate: string;
  endDate: string;
  simulatedProducts?: string[];
  scenarios?: XlngScenarioBase[];
  scenarioIds?: string[];
}
