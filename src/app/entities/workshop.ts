export interface SlackChannelDetails {
  id: string;
  name: string;
  topic?: string;
  purpose?: string;
  slackUrl?: string;
}

export interface WorkshopResourceManager {
  id: string;
  name: string;
  slackUrl?: string;
}

export interface WorkshopCheckout {
  id: string;
  active: boolean;
  checkedOutAt?: string;
  revokedAt?: string;
  approvedByName?: string;
}

export interface WorkshopCheckoutRequest {
  id: string;
  note?: string;
  requestDate?: string;
  status: string;
}

export interface WorkshopTool {
  id: string;
  name: string;
  wikiUrl: string;
  gdriveId?: string;
  description?: string;
  disabled: boolean;
  reservable: boolean;
  prerequisiteIds: string[];
  prerequisiteNames: string[];
  unmetPrerequisiteIds: string[];
  unmetPrerequisiteNames: string[];
  checkout?: WorkshopCheckout;
  checkoutRequest?: WorkshopCheckoutRequest;
  checkoutRequestable: boolean;
  reservationAvailable: boolean;
  usersChannel?: string;
  usersChannelDetails?: SlackChannelDetails;
}

export interface WorkshopVolunteerEvent {
  id: string;
  title: string;
  description?: string;
  creditValue: number;
  eventDate: string;
}

export interface WorkshopVolunteerTask {
  id: string;
  taskNumber: number;
  title: string;
  description: string;
  creditValue: number;
  status: string;
  prerequisiteToolNames: string[];
  missingPrerequisiteToolNames: string[];
  eligible: boolean;
}

export interface Workshop {
  id: string;
  name: string;
  wikiUrl: string;
  gdriveId?: string;
  slackChannel?: string;
  slackChannelDetails?: SlackChannelDetails;
  disabled: boolean;
  reservable: boolean;
  reservationsAvailable: boolean;
  resourceManagersWikiUrl: string;
  resourceManagers: WorkshopResourceManager[];
  upcomingVolunteerEvents: WorkshopVolunteerEvent[];
  volunteerTasks: WorkshopVolunteerTask[];
  canAddTool: boolean;
  canCreateVolunteerTask: boolean;
  isShopManager: boolean;
  tools: WorkshopTool[];
}

export interface WorkshopsResponse {
  canAddShop: boolean;
  workshops: Workshop[];
}
