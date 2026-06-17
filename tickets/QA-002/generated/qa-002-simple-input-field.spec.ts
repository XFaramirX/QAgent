import { test, expect } from '@playwright/test';

const TARGET_URL = 'https://www.qa-practice.com/elements/input/simple';

test.describe('QA-002 - Simple Input Field', () => {
    test('TS-001: page load shows a visible textbox', async ({ page }) => {
        await page.goto(TARGET_URL);

        const textInput = page.getByRole('textbox', { name: 'Text string*' });
        await expect(textInput).toBeVisible();
    });

    test('TS-002: textbox accepts typed text', async ({ page }) => {
        await page.goto(TARGET_URL);

        const textInput = page.getByRole('textbox', { name: 'Text string*' });
        const value = 'QA002_value_01';

        await textInput.fill(value);
        await expect(textInput).toHaveValue(value);
    });

    test('TS-003: keyboard-only entry and submission with Enter works', async ({ page }) => {
        await page.goto(TARGET_URL);

        const textInput = page.getByRole('textbox', { name: 'Text string*' });
        const submittedValue = 'QA002_keyboard_submit';

        await test.step('Reach input with keyboard and type value', async () => {
            for (let index = 0; index < 20; index += 1) {
                await page.keyboard.press('Tab');
                if (await textInput.evaluate((element) => element === document.activeElement)) {
                    break;
                }
            }
            await expect(textInput).toBeFocused();
            await page.keyboard.type(submittedValue);
            await expect(textInput).toHaveValue(submittedValue);
        });

        await test.step('Submit with Enter and verify entered value is displayed', async () => {
            await page.keyboard.press('Enter');
            await expect(page.getByText(submittedValue, { exact: true })).toBeVisible();
        });
    });

    test('TS-004: non-empty submission shows a visible result', async ({ page }) => {
        await page.goto(TARGET_URL);

        const textInput = page.getByRole('textbox', { name: 'Text string*' });
        const submittedValue = 'QA002_nonempty_submit';

        await textInput.fill(submittedValue);
        await textInput.press('Enter');

        await expect(page.getByText(submittedValue, { exact: true })).toBeVisible();
    });

    test('TS-005: empty submission behavior is exercised for clarification', async ({ page }) => {
        await page.goto(TARGET_URL);

        const textInput = page.getByRole('textbox', { name: 'Text string*' });

        await expect(textInput).toHaveAttribute('required', '');
        await textInput.press('Enter');
        await expect(textInput).toHaveValue('');
        // TODO: Assert exact empty-submission behavior once expected validation text/rule is confirmed.
    });

    test('TS-006: control remains a native text input', async ({ page }) => {
        await page.goto(TARGET_URL);

        const textInput = page.locator('#id_text_string');

        await expect(textInput).toBeVisible();
        await expect(textInput).toHaveAttribute('type', 'text');
        await expect(textInput).toHaveJSProperty('tagName', 'INPUT');
    });
});
