export type DisclaimerDisplayMode = 'auto' | 'show' | 'hide';

export function disclaimerModeFromStepData(stepData: unknown): DisclaimerDisplayMode {
  if (!stepData || typeof stepData !== 'object') {
    return 'auto';
  }
  const override = (stepData as Record<string, unknown>).disclaimerDisplayOverride;
  if (override === 'show' || override === 'hide') {
    return override;
  }
  return 'auto';
}

export function shouldShowDisclaimerFromSurvey(
  hasEnergyBill: string | null | undefined,
  mode: DisclaimerDisplayMode,
): boolean {
  if (mode === 'show') return true;
  if (mode === 'hide') return false;
  if (hasEnergyBill === 'Yes') return false;
  if (hasEnergyBill === 'No') return true;
  return true;
}

/** Respects admin disclaimerDisplayOverride on workflow progress, then survey. */
export async function resolveDisclaimerNeededForOpportunity(
  opportunityId: string,
): Promise<boolean> {
  const { surveyApi, workflowApi } = await import('./api');

  let mode: DisclaimerDisplayMode = 'auto';
  try {
    const progressRes = await workflowApi.getOpportunityProgress(opportunityId);
    if (progressRes.success && progressRes.data?.stepData) {
      mode = disclaimerModeFromStepData(progressRes.data.stepData);
    }
  } catch {
    // Workflow may not exist yet
  }

  if (mode !== 'auto') {
    return shouldShowDisclaimerFromSurvey(undefined, mode);
  }

  const surveyResponse = await surveyApi.getSurvey(opportunityId, { skipCache: true });
  const hasEnergyBill =
    surveyResponse.success && surveyResponse.data?.page4
      ? (surveyResponse.data.page4.hasEnergyBill as string | undefined)
      : undefined;

  return shouldShowDisclaimerFromSurvey(hasEnergyBill, 'auto');
}
