# QA-001: Simple Button Click

Target URL: https://www.qa-practice.com/elements/button/simple

## Description
The page contains a single clickable button labeled "Click". When the user clicks the button, the page must provide visible feedback confirming the action was registered.

## Acceptance Criteria
- The page loads and displays a button labeled "Click"
- The button is visible and enabled by default
- Clicking the button triggers a visible response (e.g. a result message or page change)
- The button is accessible via keyboard (Tab + Enter/Space)
- The button is not a link styled as a button — it must be a native `<button>` or `<input type="button">`

## Expected Results
- On page load: one enabled "Click" button is present
- After click: a confirmation or result is displayed on the page
- No page reload is required to see the result

## Notes
- Related pages on the same site: "Looks like a button" and "Disabled" button variants
- The site is a QA practice environment; no authentication required
- Test should cover: visible state, click interaction, and post-click feedback

## Snapshot Evidence (2026-06-11)
- Snapshot folder: `tickets/QA-001/snapshot/`
- `snapshot.md` shows one native control labeled "Click"
- `page.html` shows the control is `<input type="submit" id="submit-id-submit">` inside `<form method="post">`
- Runtime probe observed result text: `Submitted`
- Runtime probe observed a submit/navigation lifecycle while remaining on the same URL

## Open Requirement Mismatch
- Ticket currently says "No page reload is required to see the result"
- Observed behavior is same-URL form submission (navigation lifecycle present)
- Decide whether this behavior is acceptable for AC-004 or should be treated as a defect
