# Bug fix report — SR Mobile POS 1.1.1

## How the tests were run

All tests ran on the developer PC: Windows 10 Pro, 1366×768 screen at 100% scaling, Electron 44.4.3.

- **Isolated data.** Every test used a fresh temporary profile. No customer data was touched.
- **The PC was locked.** The Windows session was locked while the tests ran (`LogonUI.exe` was running). Windows discards injected OS-level mouse and keyboard input while locked.
- **How input was generated.** Typing and clicking were therefore driven by **real Chromium input events** (`webContents.sendInputEvent`: mouse down/up and key down/char/up, routed through Chromium's hit-testing and focus). Field values were never set with JavaScript.
- **OS-level mode.** The harness also has an OS-level mode (`QA_INPUT=os`, Windows `SendInput`) for an unlocked desktop; see "Not yet confirmed".

## BUG-1 (critical): New Sale customer fields cannot be typed into ("touch it and it collapses")

**Customer report:** customer name / phone / WhatsApp fields on the invoice (New Sale) screen collapse when touched and cannot be typed into.

**Reproduction** (1.1.0 code, `desktop/test/typing-repro.cjs`):
1. Sign in and open **New Sale**.
2. Without scrolling the cart panel, click **Phone number** (empty cart), or **WhatsApp number** (1 or 3 items in the cart).
3. Type.

**Result on 1.1.0:**

| Cart | Customer name | Phone | WhatsApp |
|---|---|---|---|
| empty | typed | click hit "Scan Product" button, nothing typed | below the visible panel |
| 1 item | typed | typed | click hit "Scan Product", nothing typed |
| 3 items | typed | typed | click hit "Scan Product", nothing typed |

Evidence captured on the Phone tap: the element under the pointer was the **Scan Product** button. The camera screen appeared (`cameraScreenAppeared: true`), then closed on its own (`cameraStillOpen: false`) because the PC has no camera. The field stayed empty.

**Root cause:**
- The global **Scan Product** button (`Layout.jsx`, `fixed bottom-6 right-24 z-40`) and the **AI assistant** launcher (`AiWidget.jsx`, `position:fixed; bottom:24px; right:24px; z-index:9999`) float over the bottom-right corner of the window.
- That is exactly where the New Sale cart panel shows the customer fields.
- A tap there goes to the button, which opens the camera scanner. The scanner closes instantly when no camera exists: the "collapse".

**Fix:**
- Scan and AI are now buttons in the header bar, so nothing floats over the page. The AI panel opens under the header when asked.
- When no camera is available, both scanners show a message instead of closing silently. The New Sale scanner previously stayed on a black screen.

**Regression tests:**
- `npm run test:desktop:typing` checks:
  - "no field is covered by another element": every visible field on 10 pages at 1366×768 and 1280×720 must receive its own click;
  - "New Sale customer name / phone / WhatsApp accept typing" with 0, 1 and 3 cart items.
- `npm test` includes a static guard against floating corner buttons.
- On the unmodified 1.1.0 screens these checks **fail** (verified). On 1.1.1 they **pass**.

## BUG-2 (high): typing stops after a pop-up message (Windows)

**Cause:**
- Electron on Windows has a known defect: after a native `alert()` or `confirm()` closes, fields show a cursor but typed characters are dropped until the window is re-activated.
  - Reports: [electron#31917](https://github.com/electron/electron/issues/31917), [#19977](https://github.com/electron/electron/issues/19977), [#41602](https://github.com/electron/electron/issues/41602).
  - Fix: [#54380](https://github.com/electron/electron/pull/54380), merged 2026-09-26. The 44.x backport is [#54452](https://github.com/electron/electron/pull/54452).
  - The newest Electron 44 on npm is 44.4.5 (2026-09-23), which does not contain it. The app uses 44.4.3.
- 1.1.0 used 48 native pop-ups: save errors, validation messages, delete confirmations, and a global "request failed" message.
- `window.prompt()` (the Reset data confirmation) is not supported in Electron at all, so Reset could never be confirmed.

**Fix:**
- Every `alert`/`confirm`/`prompt` is replaced by in-app dialogs (`frontend/src/dialogs.jsx`).
- Enter confirms, Esc cancels, Tab stays inside the dialog, and focus returns to the field you were using.
- Reset now asks you to type RESET in the app.

**Regression tests:**
- `npm test` fails if any native pop-up reappears in the frontend.
- The typing suite covers typing after an in-app message, typing after a confirmation (Esc and Enter), and the Reset flow, and records any native pop-up used during the run (none).
- On 1.1.0 these checks fail (verified).

**Not yet confirmed:** the Windows-level failure itself could not be re-created here, because the PC was locked. The cause is documented upstream and removed from the app. See "Not yet confirmed".

## BUG-3 (high): credit sale with decimal prices is rejected

**Reproduction** (`npm run test:desktop:sales`):
1. Add a LKR 0.10 item three times.
2. Tick **Credit sale** and press **Complete Sale**.

Before the fix (same code as 1.1.0) this showed "Enter a valid amount: 0 or more, at most two decimal places…" and **the sale was not saved**.

**Cause:** New Sale added prices in floating point, so 3 × 0.10 = 0.30000000000000004. That value was copied into the credit amount and correctly rejected by the server.

**Fix:** subtotal, discount, total and credit amount are rounded to cents in New Sale.

**Test:** the decimal credit sale now saves and records LKR 0.30 debt. `data-safety.test.js` checks exact totals across sale, debt, payment and dashboard.

## BUG-4 (medium): the "WhatsApp not sent" notice was never shown

**Cause:** the server returns a notice when the WhatsApp message is not sent, but New Sale did not pass it to the receipt page.

**Fix:** the notice is passed along and shown on the receipt.

**Test:** an offline WhatsApp opt-in sale saves in about 1 second and the receipt shows "…the notification was not sent."

## BUG-5 (medium): discount and loyalty boxes rewrote what was typed

**Cause:** the box stored a number. Typing "0" cleared it, and "0." or "10." snapped back, so decimals like 0.5 could not be typed.

**Fix:** the typed text is kept; the number used for totals is still limited (percent ≤ 100, fixed ≤ subtotal, points ≤ balance).

**Test:** "New Sale discount accepts 0 and decimals without jumping" fails on 1.1.0 and passes on 1.1.1.

## BUG-6 (low): disabled fields looked editable

Staff without a permission saw locked product fields that looked normal and ignored typing. Disabled fields are now dimmed with a "not allowed" cursor, and the product form explains that greyed-out fields need the owner's permission.

## Not a bug in the app (test-environment findings)

- **Ctrl+C / Ctrl+V:** the page receives the copy and paste events. The Windows clipboard itself could not be read or written while the session was locked, so this check is BLOCKED. Electron 44's `clipboard.readText()` also returns a Promise, which the first test version did not await.
- **Typing after minimise/restore:** on the locked PC, Windows reports the restored window as occluded, so the page stays "hidden" and cannot take focus. BLOCKED here. An on-screen restore on an unlocked desktop needs the OS-level run.
- **Percent discounts** round the discount to whole rupees (10% of 1,499.50 → LKR 150). This is unchanged existing behaviour; the saved total matches the screen.

## Not yet confirmed

- An OS-level (`QA_INPUT=os`) run on an **unlocked** desktop, including typing after a native pop-up on the 1.1.0 build.
- Confirmation on the **customer's PC** that the fields now accept typing.
- Real receipt/label printing: the Windows print dialog is also native and was not exercised.
