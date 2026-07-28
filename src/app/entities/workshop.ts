export interface WorkshopResourceManager {
  id: string;
  name: string;
  slackUrl?: string;
}

export interface WorkshopTool {
  id: string;
  name: string;
  wikiUrl: string;
  description?: string;
  disabled: boolean;
  reservable: boolean;
}

export interface Workshop {
  id: string;
  name: string;
  wikiUrl: string;
  slackChannel?: string;
  disabled: boolean;
  reservable: boolean;
  reservationsAvailable: boolean;
  resourceManagers: WorkshopResourceManager[];
  tools: WorkshopTool[];
}

export interface WorkshopsResponse {
  canAddShop: boolean;
  workshops: Workshop[];
}
