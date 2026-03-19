export interface User {
  id?: string;
  email?: string;
  ghlUserId?: string;
  [key: string]: any;
}

export interface Opportunity {
  id: string;
  name: string;
  type: 'ai' | 'manual';
  /** Set to 'MANUAL' for manual (app-created) opportunities in list responses */
  source?: string;
  /** App user id the opportunity is assigned to (e.g. for manual opportunities) */
  userId?: string;
  /** ISO 8601 date/time for scheduled survey/visit (e.g. manual opportunities). */
  scheduledAt?: string | null;
  stageName?: string;
  monetaryValue?: number;
  createdAt: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  assignedTo?: string;
  assignedToName?: string;
  /**
   * Owner/user information (added by backend on appointment/opportunity endpoints).
   * For admin views this indicates who the opportunity is assigned to (GHL owner),
   * resolved to an app user when possible.
   */
  owner?: {
    id?: string | null;
    name?: string | null;
    username?: string | null;
    email?: string | null;
    role?: string | null;
    ghlUserId?: string | null;
  } | null;
  // Location information
  address?: string;
  contactAddress?: string;
  contactPostcode?: string;
  // Appointment information
  hasAppointment?: boolean;
  appointmentCount?: number;
  validAppointmentCount?: number;
  appointmentDetails?: {
    id?: string;
    title?: string;
    date?: string | null;
    status?: string;
    confidence?: string;
    rawText?: string;
    notes?: string;
    extractedFrom?: string;
    appointmentId?: string;
    appointmentType?: string;
  } | null;
  appointmentSource?: 'automatic' | 'manual' | 'manual_tag_only' | 'none';
  classification?: 'CONFIRMED' | 'MULTIPLE' | 'NO_APPOINTMENT' | 'INVALID_APPOINTMENTS' | 'ERROR' | 'TAGGED';
  confidence?: 'HIGH' | 'MEDIUM' | 'LOW';
  reason?: string;
  // Additional details from API
  notes?: string;
  customFields?: any[];
}

// Survey types
export enum SurveyStatus {
  DRAFT = 'DRAFT',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  SUBMITTED = 'SUBMITTED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED'
}

export enum HomeOwnerAvailability {
  YES_SKIP_NEXT = 'YES_SKIP_NEXT',
  NO_REBOOK_APPOINTMENT = 'NO_REBOOK_APPOINTMENT'
}

export interface SurveyPage1 {
  date: string;
  renewableExecutiveFirstName: string;
  renewableExecutiveLastName: string;
  customerFirstName: string;
  customerLastName: string;
  customer2FirstName?: string;
  customer2LastName?: string;
  addressLine1: string;
  addressLine2?: string;
  town: string;
  county: string;
  postcode: string;
  homeOwnersAvailable: HomeOwnerAvailability;
  appointmentDateTime?: string;
}

export interface SurveyPage2 {
  selectedReasons: string[];
}

export interface SurveyPage3 {
  property?: string;
  propertyType?: string;
  bedrooms?: string;
  lengthOfStay?: string;
  movingPlans?: string;
  occupants?: string;
}

export interface SurveyPage4 {
  heatingType?: string;
  additionalFeatures?: string;
  prepaidMeter?: string;
  phaseMeter?: string;
  energyCompany?: string;
  monthlyElectricSpend?: string;
  electricPricePerUnit?: string;
  annualElectricUsage?: string;
  energyBillImage?: string;
  hasEnergyBill?: string;
}

export interface SurveyPage5 {
  epcRating?: string;
  epcCertificateImage?: string;
  previousSolarFunding?: string;
  previousCompany?: string;
}

export interface SurveyPage6 {
  financialIssues?: string;
  creditRating?: string;
  installationAvailability?: string;
}

export interface SurveyPage7 {
  frontDoorImage?: string;
  frontPropertyImage?: string;
  targetRoofsImage?: string;
  propertySidesImage?: string;
  roofAngleImage?: string;
  otherRoofImages?: string;
  roofTileType?: string;
  roofType?: string;
  roofTileCloseupImage?: string;
  internalCeilingPicturesImage?: string;
  otherBuildingsImage?: string;
  electricMeterImage?: string;
  garageImage?: string;
  fuseBoardImage?: string;
  batteryInverterLocationImage?: string;
  solarBatteryStorage?: string;
}

export interface SurveyPage8 {
  evLocation?: string;
  evChargerRequired?: string;
  evChargerQuantity?: string;
  optimisersRequired?: string;
  optimisersQuantity?: string;
  optimiserDetails?: string;
  shadingIssues?: string;
  scaffoldingRequired?: string[];
  scaffoldingThroughHouse?: string;
  scaffoldingImages?: string;
  furtherInformation?: string;
}

export interface Survey {
  id: string;
  ghlOpportunityId: string;
  ghlUserId: string;
  status: SurveyStatus;
  eligibilityScore?: number;
  rejectionReason?: string;
  page1?: SurveyPage1;
  page2?: SurveyPage2;
  page3?: SurveyPage3;
  page4?: SurveyPage4;
  page5?: SurveyPage5;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  approvedAt?: string;
  rejectedAt?: string;
}

// Workflow types
export enum StepType {
  SITE_SURVEY = 'SITE_SURVEY',
  OPEN_SOLAR = 'OPEN_SOLAR',
  CALCULATOR = 'CALCULATOR',
  PROPOSAL_GENERATION = 'PROPOSAL_GENERATION',
  DISCLAIMER_SIGNING = 'DISCLAIMER_SIGNING',
  CONTRACT_SIGNING = 'CONTRACT_SIGNING',
  EXPRESS_CONSENT = 'EXPRESS_CONSENT',
  EMAIL_CONFIRMATION = 'EMAIL_CONFIRMATION',
  INSTALLATION_SCHEDULING = 'INSTALLATION_SCHEDULING',
  FOLLOW_UP = 'FOLLOW_UP',
  PAYMENT = 'PAYMENT',
  INSTALLATION_BOOKING = 'INSTALLATION_BOOKING',
  WELCOME_EMAIL = 'WELCOME_EMAIL',
  SOLAR_PROJECTION = 'SOLAR_PROJECTION',
}

export enum StepStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  SKIPPED = 'SKIPPED',
}

export enum OpportunityStatus {
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  PAUSED = 'PAUSED',
  CANCELLED = 'CANCELLED',
}

export interface WorkflowStep {
  id: string;
  stepNumber: number;
  stepType: StepType;
  status: StepStatus;
  data?: any;
  startedAt?: string;
  completedAt?: string;
}

export interface OpportunityDetails {
  customerName: string;
  address: string;
  contactEmail?: string;
  contactPhone?: string;
  monetaryValue?: number;
  stageName?: string;
}

export interface OpportunityProgress {
  id: string;
  ghlOpportunityId: string;
  currentStep: number;
  totalSteps: number;
  status: OpportunityStatus;
  startedAt: string;
  lastActivityAt: string;
  completedAt?: string;
  stepData?: any;
  steps: WorkflowStep[];
  opportunityDetails?: OpportunityDetails;
}

export interface WorkflowStepConfig {
  stepNumber: number;
  stepType: StepType;
  title: string;
  description: string;
  required: boolean;
  estimatedDuration: number;
}

export interface Appointment {
  id: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  address: string;
  scheduledAt: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  notes?: string;
  sourceChannel: 'ai' | 'manual';
}

export interface OpenSolarProject {
  id: string;
  customerName: string;
  address: string;
  notes?: string;
  panels: SolarPanel[];
  orientation: number;
  roofPitch: number;
  shading: number;
  annualGeneration: number;
  totalCost: number;
}

export interface SolarPanel {
  id: string;
  type: string;
  wattage: number;
  quantity: number;
  cost: number;
}

export interface FluxCalculator {
  annualGeneration: number;
  savings: number;
  tariff: string;
  offPeakRate: number;
  peakRate: number;
}

export interface JotFormSurvey {
  id: string;
  customerId: string;
  eligibilityScore: number;
  photos: string[];
  status: 'pending' | 'approved' | 'declined';
}

export interface HomeTreeCheck {
  customerId: string;
  softCreditScore: number;
  eligibility: boolean;
  status: 'pending' | 'completed' | 'failed';
}

export interface LoPayPayment {
  id: string;
  amount: number;
  status: 'pending' | 'completed' | 'failed';
  customerId: string;
}

export interface Proposal {
  id: string;
  customerId: string;
  solarProject: OpenSolarProject;
  fluxCalculator: FluxCalculator;
  totalCost: number;
  annualSavings: number;
  paybackPeriod: number;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  success: boolean;
  isCorsError?: boolean;
}

export interface OpportunitiesResponse {
  ai?: {
    opportunities: Opportunity[];
  };
  manual?: {
    opportunities: Opportunity[];
  };
  opportunities?: Opportunity[];
  total?: number;
  classification?: {
    confirmedWithAppointments: number;
    taggedButNoAppointment: number;
    multipleAppointments: number;
    noAppointments: number;
  };
  user?: {
    id: string;
    name: string;
    role: string;
  };
}

export interface AppointmentsResponse {
  appointments: Appointment[];
}

export interface OpenSolarResponse {
  projects: OpenSolarProject[];
}

export interface FluxCalculatorResponse {
  calculation: FluxCalculator;
}

export interface JotFormResponse {
  survey: JotFormSurvey;
}

export interface HomeTreeResponse {
  check: HomeTreeCheck;
}

export interface LoPayResponse {
  payment: LoPayPayment;
}

export interface ProposalResponse {
  proposal: Proposal;
}

// Win/Loss tracking types
export enum OpportunityOutcomeType {
  WON = 'WON',
  LOST = 'LOST',
  ABANDONED = 'ABANDONED',
  IN_PROGRESS = 'IN_PROGRESS',
}

export interface OpportunityOutcome {
  id: string;
  ghlOpportunityId: string;
  userId: string;
  outcome: OpportunityOutcomeType;
  /**
   * Admin-controlled cancelled flag (if supported by backend).
   * Optional to stay compatible with older payloads.
   */
  cancelled?: boolean;
  isCancelled?: boolean;
  value?: number;
  duration?: number;
  stageAtOutcome?: string;
  notes?: string;
  ghlUpdatedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WinLossStats {
  totalOpportunities: number;
  won: number;
  lost: number;
  abandoned: number;
  inProgress: number;
  /**
   * Cancelled opportunities count (admin reporting).
   * Optional to stay compatible with older payloads.
   */
  cancelled?: number;
  totalValue: number;
  wonValue: number;
  conversionRate: number;
  averageDealValue: number;
  averageDuration: number;
}

export interface UserWinLossStats extends WinLossStats {
  userId: string;
  userName: string;
  userEmail: string;
  period: {
    start: string;
    end: string;
  };
}

export interface OpportunityOutcomeData {
  ghlOpportunityId: string;
  userId: string;
  outcome: OpportunityOutcomeType;
  value?: number;
  notes?: string;
  stageAtOutcome?: string;
} 