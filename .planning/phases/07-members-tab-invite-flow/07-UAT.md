---
status: complete
phase: 07-members-tab-invite-flow
source: [07-01-SUMMARY.md, 07-02-SUMMARY.md, 07-03-SUMMARY.md]
started: 2026-02-26T05:10:00Z
updated: 2026-02-26T05:20:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Members Tab Displays Member List
expected: Navigate to a club dashboard you own (My Clubs → click a club). Click the "Members" tab. You should see a list of club members, each showing: a first-letter avatar circle, their name (or email if no name), a role badge ("Owner" in red or "Organizer"), and a joined date. The old "Members management coming soon" placeholder should be gone.
result: pass

### 2. Owner Sees Remove Button on Organizer Rows
expected: As the club owner on the Members tab, you should see a trash icon button on organizer rows. The Remove button should NOT appear on your own row (the owner row).
result: pass

### 3. Member Removal Confirmation Dialog
expected: Click the trash icon on an organizer row. A confirmation dialog should appear with title "Remove member?", a description mentioning the member's name, and Cancel + Remove (red) buttons. Clicking Cancel should close the dialog without removing anyone.
result: pass

### 4. Invite Form Visible for Owner
expected: As club owner on the Members tab, below the member list you should see an "Invite Member" section with an email input (placeholder "organizer@mcgill.ca") and a "Send Invite" button.
result: pass

### 5. Invite Email Validation
expected: Enter a non-McGill email (e.g., "test@gmail.com") in the invite form and submit. You should see an error message: "Only McGill email addresses can be invited."
result: pass

### 6. Invite Creation Shows Copyable Link
expected: Enter a valid McGill email of an existing Uni-Verse user and submit. An invitation link should appear in a read-only text field with a copy button next to it. Clicking the copy button should change the icon to a checkmark briefly (link copied to clipboard).
result: pass

### 7. Pending Invitations Section
expected: After creating an invite, a "Pending Invitations" section should appear showing the invitee's email address, the invitation date, and an X button to revoke each invite.
result: pass

### 8. Invite Acceptance Page
expected: Open the copied invitation link (e.g., /invites/[token]) in a browser while logged in as the invited user. You should see a "You're in!" success page with the club name and a "Go to Club Dashboard" button.
result: pass

## Summary

total: 8
passed: 8
issues: 0
pending: 0
skipped: 0

## Gaps

[none yet]
