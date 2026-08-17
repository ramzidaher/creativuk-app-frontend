export const VISIT_TYPE_HOME = 'home-visit';
export const VISIT_TYPE_REMOTE = 'remote';

export type VisitType = typeof VISIT_TYPE_HOME | typeof VISIT_TYPE_REMOTE;

export function isRemoteVisit(visitType: VisitType | null | undefined): boolean {
  return visitType === VISIT_TYPE_REMOTE;
}
