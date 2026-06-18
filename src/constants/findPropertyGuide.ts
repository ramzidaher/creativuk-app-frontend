/** Find-property guide — FindMyAddress, OpenSolar map imagery, and Teams fallback. */

export interface PropertyGuideStep {
  title: string;
  detail: string;
}

export const FIND_PROPERTY_INTRO =
  'Look up the address in FindMyAddress, then locate the roof in OpenSolar. If the property is hard to see, switch map imagery inside OpenSolar (including Bing Maps) before asking the office for help.';

export const PROPERTY_NOT_VISIBLE_CALLOUT_TITLE =
  'Property not visible on OpenSolar or Bing Maps?';

export const PROPERTY_NOT_VISIBLE_SECTION_INTRO =
  'After trying different map sources in OpenSolar (including Bing Maps), follow this process:';

/** One-line hint for live appointments — full checklist stays in My Training + docs */
export const PROPERTY_NOT_VISIBLE_SHORT_HINT =
  'If the roof is not visible in OpenSolar (try switching map imagery, including Bing Maps), send roof, cable/angle, compass, and shading photos in Teams so the office can advise what to enter.';

export const PROPERTY_NOT_VISIBLE_STEPS: PropertyGuideStep[] = [
  {
    title: 'Clear pictures of the target roof',
    detail: 'Take photos showing the roof area where panels may be installed.',
  },
  {
    title: 'Picture of the cable to show the angle',
    detail: 'Take a photo that helps show the angle, pitch, and direction clearly.',
  },
  {
    title: 'Compass reading',
    detail: 'Stand away from the property and target roof, then take a compass reading.',
  },
  {
    title: 'Pictures of shading issues',
    detail:
      'Take photos of anything that may cause shading, such as trees, chimneys, nearby buildings, roof structures, or obstructions.',
  },
  {
    title: 'Send everything in the Teams chat',
    detail:
      'Send the photos and compass reading in the Teams chat so the team can advise what needs to be entered in the app/OpenSolar section.',
  },
];
