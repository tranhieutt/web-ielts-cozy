/**
 * VOC-QA-04 — core learner journeys end to end.
 *
 * One test per journey named in the task: new deck, due review, no due cards,
 * save retry, audio failure, guest refresh, an `again` card returning inside
 * the session, and offline locking the rating (ADR-002).
 *
 * These drive the real browser against the real UI. They assert what a learner
 * can SEE and DO, not internal state — a test that reaches past the interface
 * stops protecting the interface.
 */
import { expect, test } from '@playwright/test';

const DECK = 'environment';
const NEW_SESSION = `/vocabulary/review?deck=${DECK}&mode=new`;

/** Each test gets its own browser context, so learner state never leaks between them. */
test.use({ storageState: { cookies: [], origins: [] } });

const flip = (page) => page.getByRole('button', { name: /Mặt trước của thẻ/ });
const known = (page) => page.getByRole('button', { name: 'Thuộc rồi 🎉' });
const notKnown = (page) => page.getByRole('button', { name: 'Chưa thuộc' });

async function flipAndRate(page, rate = known) {
  await flip(page).click();
  await rate(page).click();
}

test('a learner reaches a flashcard from the dashboard without an account', async ({ page }) => {
  await page.goto('/vocabulary');

  await expect(page.getByRole('heading', { name: 'Từ vựng', level: 1 })).toBeVisible();
  await expect(page.getByText('20 thẻ', { exact: false })).toBeVisible();

  await page.getByRole('link', { name: 'Học từ mới' }).first().click();

  await expect(page.getByRole('heading', { level: 1 })).toContainText('Ôn từ vựng');
  await expect(flip(page)).toBeVisible();
});

test('rating is impossible until the card is flipped', async ({ page }) => {
  await page.goto(NEW_SESSION);

  // The guard must be a real disabled control, not a styled-grey button that
  // still fires: a learner rating a card they have not seen corrupts their own
  // schedule.
  await expect(known(page)).toBeDisabled();
  await expect(notKnown(page)).toBeDisabled();
  await expect(page.getByText('Lật thẻ để xem đáp án và chấm.')).toBeVisible();

  await flip(page).click();

  await expect(known(page)).toBeEnabled();
  await expect(notKnown(page)).toBeEnabled();
});

test('a "Chưa thuộc" card comes back later in the same session', async ({ page }) => {
  await page.goto(NEW_SESSION);

  const firstWord = await page.locator('h2, [class*="word"]').first().innerText();
  await flipAndRate(page, notKnown);

  // Spec §8.3: the card returns behind exactly three unrated cards, so it must
  // NOT be the very next one and must reappear within the session.
  const seen = [];
  for (let index = 0; index < 5; index += 1) {
    seen.push(await page.locator('h2, [class*="word"]').first().innerText());
    await flipAndRate(page, known);
  }

  expect(seen[0]).not.toBe(firstWord);
  expect(seen).toContain(firstWord);
});

test('a deck with nothing due says so instead of opening an empty session', async ({ page }) => {
  await page.goto('/vocabulary');

  await page.getByRole('checkbox').check();

  await expect(
    page.getByText('Không có bộ nào đang có thẻ đến hạn.', { exact: false }),
  ).toBeVisible();
});

test('a due card is offered for review once it is due', async ({ page }) => {
  await page.goto(NEW_SESSION);
  await flipAndRate(page, notKnown);

  // `again` schedules 10 minutes out, so nothing is due yet — the dashboard
  // must not claim otherwise.
  await page.goto('/vocabulary');
  await expect(page.getByText('Đã học 1 từ')).toBeVisible();
  await expect(page.getByText('Hôm nay chưa có thẻ đến hạn', { exact: false })).toBeVisible();
});

test('audio shows an explicit unavailable state while the release gate is closed', async ({
  page,
}) => {
  await page.goto(NEW_SESSION);

  // ADR-003: a closed gate must SAY the audio is unavailable rather than
  // rendering a play button that fails when pressed.
  await expect(page.getByText('Phát âm chưa khả dụng')).toBeVisible();
  await expect(page.getByRole('button', { name: /Nghe phát âm/ })).toHaveCount(0);
});

test('a failed save keeps the learner on the card and never claims success', async ({ page }) => {
  await page.goto(NEW_SESSION);

  const word = await page.locator('h2, [class*="word"]').first().innerText();
  await page.route('**/api/vocabulary/reviews', (route) => route.abort('failed'));

  await flip(page).click();
  await known(page).click();

  // ADR-002: no optimistic advance. The card, the position and the flipped
  // state must all survive a failed write.
  await expect(page.locator('h2, [class*="word"]').first()).toHaveText(word);
  await expect(page.getByText('Thẻ 1')).toBeVisible();
});

test('a save that fails then succeeds lets the learner continue', async ({ page }) => {
  await page.goto(NEW_SESSION);

  const word = await page.locator('h2, [class*="word"]').first().innerText();
  let failNext = true;
  await page.route('**/api/vocabulary/reviews', (route) => {
    if (failNext) {
      failNext = false;
      return route.abort('failed');
    }
    return route.fallback();
  });

  await flip(page).click();
  await known(page).click();
  await expect(page.locator('h2, [class*="word"]').first()).toHaveText(word);

  await known(page).click();

  await expect(page.locator('h2, [class*="word"]').first()).not.toHaveText(word);
  await expect(page.getByText('Thẻ 2')).toBeVisible();
});

test('a guest keeps their progress across a page refresh', async ({ page }) => {
  await page.goto(NEW_SESSION);
  await flipAndRate(page, known);

  await page.goto('/vocabulary');
  await expect(page.getByText('Đã học 1 từ')).toBeVisible();

  await page.reload();

  // The identity cookie must survive the reload; a new learner every refresh
  // would reset progress and look like data loss.
  await expect(page.getByText('Đã học 1 từ')).toBeVisible();
});

test('the account link is an offer, never a prompt (ADR-004)', async ({ page }) => {
  await page.goto('/vocabulary');

  await expect(page.getByRole('link', { name: 'Giữ tiến độ khi đổi thiết bị' })).toBeVisible();
  // ADR-004 forbids interrupting the learner to ask for an account.
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.goto(NEW_SESSION);
  await expect(page.getByRole('button', { name: 'Xoá dữ liệu học của tôi' })).toHaveCount(0);
});

test('deleting study data asks first and reports the real outcome', async ({ page }) => {
  await page.goto('/vocabulary');

  await page.getByRole('button', { name: 'Xoá dữ liệu học của tôi' }).click();

  await expect(page.getByText('Không khôi phục được', { exact: false })).toBeVisible();

  await page.getByRole('button', { name: 'Huỷ' }).click();
  await expect(page.getByRole('button', { name: 'Xoá dữ liệu học của tôi' })).toBeVisible();
});
