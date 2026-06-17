export interface TrainingScenarioTemplate {
  scenarioNumber: number;
  customerName: string;
  hasEnergyBill: boolean;
  currentRatePence: number | null;
  cappedRatePence: number | null;
  annualUsageKwh: number | null;
  monthlyDirectDebit: number | null;
  usageCalculationHint: string | null;
  phase: 'single';
  propertyType: string;
  address: string;
  scenarioNotes: string;
}

export interface TrainingGuideLink {
  label: string;
  url: string;
}

export interface TrainingHowToGuide {
  id: string;
  title: string;
  description: string;
  /** Single external guide — opens directly when tapped */
  url?: string;
  /** Multiple guides — user picks which to open */
  links?: TrainingGuideLink[];
}

export const TRAINING_TARIFF_REFERENCE = {
  supplier: '100Green Smart Tide',
  currentElectricity: {
    withBill: "Use the customer's latest bill if available",
    withoutBill: 'If no bill is available, use 25p/kWh',
  },
  newElectricity: {
    singleRate: {
      dayRatePence: 27.73,
      nightRatePence: 7,
      nightHours: 7,
    },
    dualRate: {
      dayRatePence: 36.26,
      nightRatePence: 7,
      nightHours: 7,
    },
    exportRatePence: 12,
  },
};

export const TRAINING_HOW_TO_GUIDES: TrainingHowToGuide[] = [
  {
    id: 'find-property',
    title: 'How to find the property',
    description: 'Look up the address and verify the correct property before designing.',
    url: 'https://www.findmyaddress.co.uk/search',
  },
  {
    id: 'opensolar-design',
    title: 'How to design on OpenSolar',
    description: 'OpenSolar design guide — satellite imagery, panel placement, and saving your design.',
    url: 'https://support.opensolar.com/hc/en-us/articles/7576156328207--Design',
  },
  {
    id: 'complete-app',
    title: 'How to complete the app',
    description: 'Pick a step-by-step guide to follow through the full appointment workflow.',
    links: [
      {
        label: 'App step-by-step (SharePoint)',
        url: 'https://jarmqltd-my.sharepoint.com/:w:/r/personal/pamela_rennie_creativuk_co_uk/_layouts/15/Doc.aspx?sourcedoc=%7B2111CCBC-147A-43B0-9A79-7B892389B1DB%7D&file=App%20%25u2013%20Step%20by%20Step%20This%20is%20a%20step%20by%20step.docx&fromShare=true&action=default&mobileredirect=true',
      },
      {
        label: 'Creativ UK docs',
        url: 'https://docs.app.creativuk.co.uk/',
      },
    ],
  },
];

export const TRAINING_SCENARIO_TEMPLATES: TrainingScenarioTemplate[] = [
  {
    scenarioNumber: 1,
    customerName: 'Mr Jones',
    hasEnergyBill: true,
    currentRatePence: 26,
    cappedRatePence: null,
    annualUsageKwh: 5240,
    monthlyDirectDebit: null,
    usageCalculationHint: null,
    phase: 'single',
    propertyType: 'Semi-detached',
    address: '58 Bamber Street, Peterborough, PE1 2HN',
    scenarioNotes: 'Single-rate customer with energy bill. Single-phase.',
  },
  {
    scenarioNumber: 2,
    customerName: 'Mrs Smith',
    hasEnergyBill: false,
    currentRatePence: null,
    cappedRatePence: 25,
    annualUsageKwh: null,
    monthlyDirectDebit: null,
    usageCalculationHint: 'Monthly Direct Debit × 12 ÷ 0.25 = Annual Usage (e.g. £120 × 12 ÷ 0.25 = 5,760 kWh)',
    phase: 'single',
    propertyType: 'Semi-detached',
    address: 'Huntly Grove, Peterborough, PE1 2QW',
    scenarioNotes: 'No energy bill — use capped rate 25p/kWh. Single-phase.',
  },
  {
    scenarioNumber: 3,
    customerName: 'Mr Patel',
    hasEnergyBill: true,
    currentRatePence: 28,
    cappedRatePence: null,
    annualUsageKwh: 6850,
    monthlyDirectDebit: null,
    usageCalculationHint: null,
    phase: 'single',
    propertyType: 'Detached',
    address: 'Eastern Avenue, Peterborough, PE1',
    scenarioNotes: 'Works from home, wants to reduce daytime costs. Interested in battery storage. Single-phase.',
  },
  {
    scenarioNumber: 4,
    customerName: 'Mrs Brown',
    hasEnergyBill: false,
    currentRatePence: null,
    cappedRatePence: 25,
    annualUsageKwh: 7200,
    monthlyDirectDebit: 150,
    usageCalculationHint: '£150 × 12 ÷ 0.25 = 7,200 kWh',
    phase: 'single',
    propertyType: 'Detached',
    address: 'Birchtree Avenue, Peterborough, PE1 4HN',
    scenarioNotes: 'Recently moved, no historical bills. Looking to reduce future electricity costs. Single-phase.',
  },
  {
    scenarioNumber: 5,
    customerName: 'Mr Wilson',
    hasEnergyBill: true,
    currentRatePence: 27,
    cappedRatePence: null,
    annualUsageKwh: 4980,
    monthlyDirectDebit: null,
    usageCalculationHint: null,
    phase: 'single',
    propertyType: 'Detached',
    address: 'Eastfield Road, Peterborough, PE1 4BH',
    scenarioNotes: 'Owns an EV, expects usage to increase. Size system for future demand. Single-phase.',
  },
];
