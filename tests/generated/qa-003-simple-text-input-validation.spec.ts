import { test, expect } from '@playwright/test';

const TARGET_URL = 'https://www.qa-practice.com/elements/input/simple';

// Maximum number of Tab presses when navigating to the text input via keyboard.
// The page has a nav sidebar before the main content area, so up to 20 Tabs
// may be needed before the input receives focus.
const MAX_TAB_ATTEMPTS = 20;

test.describe('QA-003 - Simple text input field — submit & validation', () => {
    // TS-001 / AC-004: Page load shows a visible, labeled text input
    test('TS-001: page load shows a visible labeled text input', async ({ page }) => {
        await page.goto(TARGET_URL);

        const textInput = page.getByRole('textbox', { name: 'Text string*' });
        await expect(textInput).toBeVisible();
    });

    // TS-002 / AC-001 + AC-002: Non-empty submission echoes the submitted value
    test('TS-002: submitting a non-empty value shows a success message containing the value', async ({ page }) => {
        await page.goto(TARGET_URL);

        const textInput = page.getByRole('textbox', { name: 'Text string*' });
        const submittedValue = 'QA003_submit_test';

        await textInput.fill(submittedValue);
        await textInput.press('Enter');

        await expect(page.getByText(submittedValue, { exact: true })).toBeVisible();
    });

    // TS-003 / AC-003: Empty submission does not display a success message
    test('TS-003: submitting an empty field does not show a success message', async ({ page }) => {
        await page.goto(TARGET_URL);

        const textInput = page.getByRole('textbox', { name: 'Text string*' });

        // The field is required; native validation should block the submission
        await expect(textInput).toHaveAttribute('required', '');
        await textInput.press('Enter');

        // The input should remain empty and no success/result text should appear
        await expect(textInput).toHaveValue('');
        await expect(page.getByText('QA003_submit_test', { exact: true })).not.toBeVisible();
    });

    // TS-004 / AC-004: Input accessible by ARIA role and label
    test('TS-004: input is accessible by role and label', async ({ page }) => {
        await page.goto(TARGET_URL);

        const textInput = page.getByRole('textbox', { name: 'Text string*' });
        await expect(textInput).toBeVisible();
        await expect(textInput).toBeEditable();

        // Confirm underlying element is a native text input
        const nativeInput = page.locator('#id_text_string');
        await expect(nativeInput).toHaveAttribute('type', 'text');
        await expect(nativeInput).toHaveJSProperty('tagName', 'INPUT');
    });

    // TS-005 / AC-005: Full keyboard-only submission flow
    test('TS-005: keyboard-only submission flow works end to end', async ({ page }) => {
        await page.goto(TARGET_URL);

        const textInput = page.getByRole('textbox', { name: 'Text string*' });
        const submittedValue = 'QA003_kb_flow';

        await test.step('Tab to the input and type a value', async () => {
            for (let index = 0; index < MAX_TAB_ATTEMPTS; index += 1) {
                await page.keyboard.press('Tab');
                if (await textInput.evaluate((el) => el === document.activeElement)) {
                    break;
                }
            }
            await expect(textInput).toBeFocused();
            await page.keyboard.type(submittedValue);
            await expect(textInput).toHaveValue(submittedValue);
        });

        await test.step('Submit with Enter and verify echoed value', async () => {
            await page.keyboard.press('Enter');
            await expect(page.getByText(submittedValue, { exact: true })).toBeVisible();
        });
    });
});
