import { test, expect } from '@playwright/test';

const TARGET_URL = 'https://www.qa-practice.com/elements/button/simple';

test.describe('QA-001 – Simple Button Click', () => {

    test('TS-001: submit control is present and enabled on page load', async ({ page }) => {
        await page.goto(TARGET_URL);
        const submitControl = page.getByRole('button', { name: 'Click' });

        await expect(submitControl).toBeVisible();
        await expect(submitControl).toBeEnabled();
    });

    test('TS-002: clicking submit shows exact Submitted feedback', async ({ page }) => {
        await page.goto(TARGET_URL);
        const submitControl = page.getByRole('button', { name: 'Click' });

        await test.step('activate the Click submit control', async () => {
            await submitControl.click();
        });

        await test.step('verify exact user feedback text', async () => {
            await expect(page.getByText('Submitted', { exact: true })).toBeVisible();
        });
    });

    test('TS-003: submit lifecycle occurs while final URL remains the same', async ({ page }) => {
        await page.goto(TARGET_URL);

        const submitControl = page.getByRole('button', { name: 'Click' });
        const navigation = page.waitForNavigation({ url: TARGET_URL });

        await submitControl.click();
        await navigation;

        await expect(page).toHaveURL(TARGET_URL);
        await expect(page.getByText('Submitted', { exact: true })).toBeVisible();
    });

    test('TS-004: submit control is keyboard-activatable with Enter and Space', async ({ page }) => {
        await page.goto(TARGET_URL);
        const submitInput = page.locator('#submit-id-submit');

        await test.step('focus submit input and activate with Enter', async () => {
            await submitInput.focus();
            await expect(submitInput).toBeFocused();
            await page.keyboard.press('Enter');
            await expect(page.getByText('Submitted', { exact: true })).toBeVisible();
        });

        await test.step('reload and activate with Space', async () => {
            await page.goto(TARGET_URL);
            await submitInput.focus();
            await expect(submitInput).toBeFocused();
            await page.keyboard.press('Space');
            await expect(page.getByText('Submitted', { exact: true })).toBeVisible();
        });
    });

    test('TS-005: interactive control is native input[type="submit"]', async ({ page }) => {
        await page.goto(TARGET_URL);
        const submitInput = page.locator('#submit-id-submit');

        await expect(submitInput).toBeVisible();
        await expect(submitInput).toHaveAttribute('type', 'submit');
        await expect(submitInput).toHaveValue('Click');
    });

    test('TS-006: repeated submissions keep working and preserve URL', async ({ page }) => {
        await page.goto(TARGET_URL);
        const submitControl = page.getByRole('button', { name: 'Click' });

        for (let i = 0; i < 2; i++) {
            await submitControl.click();
            await expect(page).toHaveURL(TARGET_URL);
            await expect(page.getByText('Submitted', { exact: true })).toBeVisible();
        }
    });

});
