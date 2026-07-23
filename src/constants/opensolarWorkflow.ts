/** Shared copy for OpenSolar prep + linking (normal appointments and training). */

export const OPENSOLAR_PREP_TITLE = 'Create your OpenSolar design first';

export const OPENSOLAR_PREP_MESSAGE =
  'Before you start Solar Progress in the app, create and save the OpenSolar design for this property. You will link that design in step 2 using the OpenSolar project ID or property address.';

export const OPENSOLAR_STEP_TITLE = 'Link OpenSolar Design';

export const OPENSOLAR_STEP_DESCRIPTION =
  'Enter the OpenSolar project ID or property address to link the design you created for this customer.';

export const OPENSOLAR_LINK_SCREEN_TITLE = 'Link OpenSolar Design';

export const OPENSOLAR_LINK_SCREEN_INTRO =
  'Link the OpenSolar design you created for this property before the appointment. Use the project ID from OpenSolar (Manage tab) or the property address — do not browse unrelated projects.';

export const OPENSOLAR_LINK_BY_ID_HINT =
  'Find the project ID in OpenSolar under Manage → copy the ID for this customer\'s design.';

export const OPENSOLAR_LINK_BY_ADDRESS_HINT =
  'Enter the same property address as the OpenSolar project, then pick the matching design from the results.';

export interface OpenSolarDesignGuideLink {
  label: string;
  url: string;
}

/** OpenSolar Design tab — work through in order before linking in step 2. */
export const OPENSOLAR_DESIGN_GUIDE_INTRO =
  'Work through the Design tab in OpenSolar using these guides (in order). When the design is saved, note the project ID from the Manage tab for step 2.';

export const OPENSOLAR_DESIGN_GUIDE_LINKS: OpenSolarDesignGuideLink[] = [
  {
    label: '1. Start a new project',
    url: 'https://support.opensolar.com/hc/en-us/articles/7576156328207--Design#h_01HB3BTQFJ7BKP12VBK9TJM5K2',
  },
  {
    label: '2. Auto 3D design (try this first)',
    url: 'https://support.opensolar.com/hc/en-us/articles/7576156328207--Design#h_01HB3BTQFJ2CATD4FQT4X0212A',
  },
  {
    label: '3. Battery only or retrofit (if applicable)',
    url: 'https://support.opensolar.com/hc/en-us/articles/7576156328207--Design#01HNMN5CCAJ77TXT9HTJS9J8T6',
  },
  {
    label: '4. Manual 3D design (if auto does not work)',
    url: 'https://support.opensolar.com/hc/en-us/articles/7576156328207--Design#h_01HB3BTQFJB2KB063QT449KEZM',
  },
  {
    label: '5. Upload building plans or aerial imagery',
    url: 'https://support.opensolar.com/hc/en-us/articles/7576156328207--Design#h_01HB3BTQFJ342291YKWNWSKR95',
  },
  {
    label: '6. MCS, shading, and commercial tools',
    url: 'https://support.opensolar.com/hc/en-us/articles/7576156328207--Design#h_01HB3BTQFJW9GDTZR00W5SZN4A',
  },
  {
    label: '7. Payback calculations — finish and save',
    url: 'https://support.opensolar.com/hc/en-us/articles/7576156328207--Design#h_01HB3BTQFJTC5D4JC8N01SP29B',
  },
];
