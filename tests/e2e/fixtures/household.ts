import { Page } from '@playwright/test';
import { MemberPage } from '../pages/MemberPage';

export async function openHouseholdProfile(page: Page, role: 'primary' | 'secondary'): Promise<string> {
  const member = new MemberPage(page);
  await member.goToMembersList();
  await member.searchMembers(`household_${role}`);
  await member.clickMemberLink(role === 'primary' ? 'Household Primary' : 'Household Secondary');
  return member.getProfileUrl();
}
