import { test, expect } from '@playwright/test';
import { AuthPage } from '../pages/AuthPage';
import { MemberPage } from '../pages/MemberPage';
import { AdminVolunteerPage, MemberVolunteerPage } from '../pages/AdminVolunteerPage';
import { adminMember, basicMember } from '../fixtures/testData';

// ── Test 1: Admin creates a volunteer event ───────────────────────────────────

test.describe('Admin creates volunteer event', () => {

  test('Admin creates Member Clean Up Day event', async ({ page }) => {
    const auth      = new AuthPage(page);
    const volunteer = new AdminVolunteerPage(page);

    await auth.signIn(adminMember.email, adminMember.password);
    await volunteer.goto();
    await volunteer.goToTab('Events');
    await volunteer.createEvent(
      'Member Clean Up Day',
      'Come help clean up and finish projects around the Makerspace',
      '2026-06-01',
      2
    );
    await volunteer.verifyEventInTable('Member Clean Up Day');
  });
});

// ── Test 2: Bounty task lifecycle ─────────────────────────────────────────────

test.describe('Bounty task lifecycle', () => {
  const TASK_1 = 'clean bathrooms';
  const TASK_2 = 'sweep woodshop';

  test('Admin creates two bounty tasks', async ({ page }) => {
    const auth      = new AuthPage(page);
    const volunteer = new AdminVolunteerPage(page);

    await auth.signIn(adminMember.email, adminMember.password);
    await volunteer.goto();
    await volunteer.goToTab('Bounty Tasks');

    await volunteer.createTask(TASK_1, 'clean all three bathrooms', 1);
    await volunteer.verifyTaskInTable(TASK_1);

    await volunteer.createTask(TASK_2, 'sweep woodshop before open house', 0.5);
    await volunteer.verifyTaskInTable(TASK_2);
  });

  test('Member claims and completes first available task', async ({ page }) => {
    const auth      = new AuthPage(page);
    const member    = new MemberPage(page);
    const volunteer = new MemberVolunteerPage(page);

    await auth.signIn(basicMember.email, basicMember.password);
    await member.waitForProfile();
    await member.dismissNotificationModal();
    await volunteer.goToVolunteerTab();

    // Claim first available task
    await volunteer.selectFirstAvailableTask();
    await volunteer.claimTask();

    // Mark complete
    await volunteer.selectClaimedTask();
    await volunteer.markComplete();
    await volunteer.verifyTaskStatus('Pending Verification');
  });

  test('Admin verifies completed task', async ({ page }) => {
    const auth      = new AuthPage(page);
    const volunteer = new AdminVolunteerPage(page);

    await auth.signIn(adminMember.email, adminMember.password);
    await volunteer.goto();
    await volunteer.goToTab('Bounty Tasks');

    // Verify task shows pending
    await expect(page.getByText('Pending Verification').first())
      .toBeVisible({ timeout: 10_000 });

    // Select and verify
    await volunteer.selectTaskByTitle(TASK_1);
    await volunteer.clickVerify();

    await expect(page.getByText('Completed').first())
      .toBeVisible({ timeout: 10_000 });
  });

  test('Member sees task as approved', async ({ page }) => {
    const auth      = new AuthPage(page);
    const member    = new MemberPage(page);
    const volunteer = new MemberVolunteerPage(page);

    await auth.signIn(basicMember.email, basicMember.password);
    await member.waitForProfile();
    await member.dismissNotificationModal();
    await volunteer.goToVolunteerTab();

    await volunteer.verifyTaskStatus('Approved');
  });
});
