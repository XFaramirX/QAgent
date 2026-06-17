import { test, expect } from '@playwright/test';

const TARGET_URL = 'https://www.qa-practice.com/elements/button/simple';

test.describe('QA-001 - Simple Button Click', () => {
    test('TS-001: submit control is present and enabled on page load', async ({ page }) => {
        await page.goto(TARGET_URL);

        const submitControl = page.getByRole('button', { name: 'Click' });
        await expect(submitControl).toBeVisible();
        await expect(submitControl).toBeEnabled();
    });

    test('TS-002: clicking the submit control shows Submitted text', async ({ page }) => {
        await page.goto(TARGET_URL);

        await test.step('Activate the Click submit control', async () => {
            await page.getByRole('button', { name: 'Click' }).click();
        });

        await test.step('Verify visible confirmation text', async () => {
            await expect(page.getByText('Submitted', { exact: true })).toBeVisible();
        });
    });

    test('TS-003: submitting keeps the same page URL', async ({ page }) => {
        await page.goto(TARGET_URL);

        const beforeSubmitUrl = page.url();
        await page.getByRole('button', { name: 'Click' }).click();

        await expect(page).toHaveURL(beforeSubmitUrl);
        await expect(page.getByText('Submitted', { exact: true })).toBeVisible();
    });

    test('TS-004: submit control is keyboard activatable with Enter and Space', async ({ page }) => {
        await page.goto(TARGET_URL);

        const nativeSubmit = page.locator('#submit-id-submit');

        await test.step('Tab focus and Enter activation', async () => {
            await page.keyboard.press('Tab');
            await expect(nativeSubmit).toBeFocused();
            await page.keyboard.press('Enter');
            await expect(page.getByText('Submitted', { exact: true })).toBeVisible();
        });

        await test.step('Fresh page and Space activation', async () => {
            await page.goto(TARGET_URL);
            await page.keyboard.press('Tab');
            await expect(nativeSubmit).toBeFocused();
            await page.keyboard.press('Space');
            await expect(page.getByText('Submitted', { exact: true })).toBeVisible();
        });
    });

    test('TS-005: interactive element is native input type submit', async ({ page }) => {
        await page.goto(TARGET_URL);

        const nativeSubmit = page.locator('#submit-id-submit');
        await expect(nativeSubmit).toBeVisible();
        await expect(nativeSubmit).toHaveAttribute('type', 'submit');
        await expect(nativeSubmit).toHaveValue('Click');
    });

    test('TS-006: repeated submissions remain stable', async ({ page }) => {
        await page.goto(TARGET_URL);

        const submitControl = page.getByRole('button', { name: 'Click' });

        for (let index = 0; index < 2; index += 1) {
            await submitControl.click();
            await expect(page).toHaveURL(TARGET_URL);
            await expect(page.getByText('Submitted', { exact: true })).toBeVisible();
        }
    });
});