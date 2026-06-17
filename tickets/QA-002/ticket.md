# QA-002: Simple Input Field

Target URL: https://www.qa-practice.com/elements/input/simple

## Description
The page provides a single text input where the user can type a value and submit it. After submission, the page should display visible feedback based on the entered value.

## Acceptance Criteria
- The page loads and shows a visible input field
- The input is editable and accepts typed text
- Submitting a non-empty value shows visible confirmation/result
- The field is keyboard accessible
- The input control is a native text input, not a non-input element styled as one

## Expected Results
- On page load: one visible editable text input is present
- After entering a value and submitting: a visible result/confirmation appears
- The result reflects the submitted value or a deterministic success message

## Notes
- QA practice environment; no authentication expected
- Cover positive flow and at least one validation/empty-input behavior if present

## Snapshot Evidence (2026-06-11)
- Snapshot captured from https://www.qa-practice.com/elements/input/simple.
- Page title observed: Input Field | Text Input | QA Practice.
- Visible page heading: Input field.
- Visible control observed: textbox labeled Text string* with placeholder Submit me.
- The observed input control is a native textbox role in the accessibility tree.
- A button labeled Requirements: is visible in the captured state.
- Console contains one warning and one uncaught error related to handleToggleNavProfile in site JavaScript.

## Open Requirement Mismatch
- Ticket expects an explicit submit action and visible result/confirmation after submission, but the captured state evidence does not show a visible submit control or a visible result area before interaction.
- Empty-input validation behavior is requested in notes, but no validation message or rule is visible in the captured static state.
