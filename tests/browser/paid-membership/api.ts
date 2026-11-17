import type { ContinuousPaidMembership } from '../../../src/api/continuousPaidMembership';
export class PaidMembershipError extends Error { status: number; }
export async function getContinuousPaidMembership() {
  const state = (window as any).fixtureState;
  state.reads++;
  if (state.mode === 'error' && state.reads === 1) throw new Error('Unable to load paid membership. Retry.');
  if (state.mode === 'loading') await new Promise(resolve => { state.resolve = resolve; });
  return { ...state.balance } as ContinuousPaidMembership;
}
export async function increaseContinuousPaidMembership(_id: string, body: any) {
  const state = (window as any).fixtureState;
  state.lastWrite = body;
  if (state.mode === 'conflict' && !state.conflicted) {
    state.conflicted = true;
    state.balance = { continuousPaidMembershipMonths: 15, revision: 9, estimated: false };
    throw Object.assign(new Error('Conflict'), { status: 409 });
  }
  state.balance = { ...state.balance, continuousPaidMembershipMonths: body.continuousPaidMembershipMonths, revision: state.balance.revision + 1 };
  return { ...state.balance } as ContinuousPaidMembership;
}
