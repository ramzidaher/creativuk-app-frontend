import {
  FIND_PROPERTY_INTRO,
  PROPERTY_NOT_VISIBLE_CALLOUT_TITLE,
  PROPERTY_NOT_VISIBLE_SECTION_INTRO,
  PROPERTY_NOT_VISIBLE_STEPS,
} from './findPropertyGuide';
import { OPENSOLAR_DESIGN_GUIDE_INTRO, OPENSOLAR_DESIGN_GUIDE_LINKS } from './opensolarWorkflow';

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

export interface TrainingGuideCallout {
  title: string;
  body: string;
}

export interface TrainingGuideSection {
  title: string;
  intro?: string;
  steps?: { title: string; detail: string }[];
  /** Amber highlight box (e.g. property-not-on-map fallback) */
  highlight?: boolean;
}

export interface TrainingHowToGuide {
  id: string;
  title: string;
  description: string;
  /** Single external guide — opens directly when tapped */
  url?: string;
  /** Multiple guides — user picks which to open */
  links?: TrainingGuideLink[];
  /** In-app callout (e.g. property not on OpenSolar) */
  callout?: TrainingGuideCallout;
  /** Expandable in-app steps shown below the description */
  sections?: TrainingGuideSection[];
}

export const TRAINING_TARIFF_REFERENCE = {
  supplier: '100Green Smart Tide',
  currentElectricity: {
    withBill: "Use the customer's latest bill if available",
    withoutBill: 'If no bill is available, use capped rate 25p/kWh',
  },
  noBillUsage: {
    title: 'No energy bill — calculate annual usage',
    cappedRateNote: 'Use capped rate 25p/kWh (0.25 in the formula below).',
    formula: 'Monthly direct debit × 12 ÷ 0.25 = Annual usage (kWh)',
    example: 'Example: £120 × 12 ÷ 0.25 = 5,760 kWh',
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
    description: FIND_PROPERTY_INTRO,
    url: 'https://www.findmyaddress.co.uk/search',
    sections: [
      {
        title: PROPERTY_NOT_VISIBLE_CALLOUT_TITLE,
        intro: PROPERTY_NOT_VISIBLE_SECTION_INTRO,
        steps: PROPERTY_NOT_VISIBLE_STEPS,
        highlight: true,
      },
    ],
  },
  {
    id: 'opensolar-design',
    title: 'How to design on OpenSolar',
    description: OPENSOLAR_DESIGN_GUIDE_INTRO,
    links: OPENSOLAR_DESIGN_GUIDE_LINKS,
  },
  {
    id: 'complete-app',
    title: 'How to complete the app',
    description: 'Step-by-step Word guide for the full appointment workflow.',
    url: 'https://jarmqltd-my.sharepoint.com/:w:/r/personal/pamela_rennie_creativuk_co_uk/_layouts/15/Doc.aspx?sourcedoc=%7B2111CCBC-147A-43B0-9A79-7B892389B1DB%7D&file=App%20%25u2013%20Step%20by%20Step%20This%20is%20a%20step%20by%20step.docx&fromShare=true&action=default&mobileredirect=true',
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
