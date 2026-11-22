import { test } from '@playwright/test';
import { createMemberAsAdmin, setComplimentaryExpiration } from '../fixtures/fobRegistration';
import { buildTestMember } from '../fixtures/testData';
import { MemberPage } from '../pages/MemberPage';

test('Fob modal shows the address of an admin-created member', async ({ page }) => {
  const newMember = buildTestMember('backup-admincreated');
  await createMemberAsAdmin(page, newMember);

  const member = new MemberPage(page);
  await setComplimentaryExpiration(member);
  await member.openFobModal();
  await member.verifyAddressInFobModal(newMember.address);
});
