# QA-003: Simple text input field — submit & validation

Target URL: https://www.qa-practice.com/elements/input/simple

## Description

The simple input page at qa-practice.com provides a single text input field.
When the user enters text and submits the form (via Enter key), the page should
display a success message that reflects the submitted value. When the field is
empty and the form is submitted, an appropriate empty-state response (native
required-field validation) should prevent the success message from appearing.

## Acceptance Criteria

- AC-001: Typing text into the input field and submitting displays a success message
- AC-002: The success message contains or reflects the submitted value
- AC-003: Submitting with an empty field does not show a success message
- AC-004: The input field is accessible by label or role
- AC-005: The form submission mechanism is keyboard accessible

## Expected Results

- On page load: one visible, required text input labeled "Text string*" is present
- After entering a valid value and submitting: the submitted value is displayed on the page
- After attempting empty submission: no success message is shown (native required-field validation blocks it)

## Notes

- Target is a QA practice environment; no authentication required
- The form has no explicit Submit button; submission is triggered by pressing Enter
- The input has a `required` attribute that prevents empty-value submission
- The page reflects the submitted text as the success message

## Snapshot Evidence (2026-07-21)

- Snapshot captured from https://www.qa-practice.com/elements/input/simple
- Page title: Input Field | Text Input | QA Practice
- Visible heading: Input field
- One native textbox labeled "Text string*" with placeholder "Submit me"
- Form uses POST method; input id is `id_text_string`
- Requirements (collapsed section): min 2, max 25 chars; submit via Enter; submitted text is echoed
