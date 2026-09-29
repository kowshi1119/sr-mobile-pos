# SR Mobile POS 1.1.1 — release notes

**Status: test candidate.** Please try it on one shop PC first; see "Still to be checked" below.

## What is fixed

- **Customer details can be typed on New Sale.** Before, tapping the customer's phone or WhatsApp number could open the camera scanner, which closed at once ("collapsed"), so nothing could be typed. The floating **Scan Product** and **AI** buttons that covered those fields are now in the top bar.
- **Typing keeps working after a message or confirmation.** On Windows, the old pop-up boxes could leave fields that no longer accepted typing. All messages and "Are you sure?" questions now appear inside the app. Press Enter for OK or Esc to cancel.
- **Credit sales with cents work.** For example, three items at LKR 0.10 on credit used to be rejected; they now save correctly.
- **You are told when a WhatsApp message was not sent** (for example with no internet). The sale is still saved.
- **Discount and loyalty-point boxes** accept 0 and decimals such as 0.5 without jumping.
- **Reset All Data** works again. You now type RESET in the app to confirm.
- **Camera scanner:** if the PC has no camera, the app says so and suggests the USB barcode scanner or Search.
- **Locked fields look locked.** Staff can see which fields need the owner's permission.

## Nothing to set up

Your data, logins, staff permissions, backups and settings are kept when you install 1.1.1 over 1.1.0.

## Still to be checked before calling this final

- Typing checked with real keyboard input on an unlocked Windows desktop (only simulated input was possible on the build PC).
- Installation and typing on the customer's own PC.
- Receipt and label printing on the shop's printer, and the barcode scanner hardware.
- Use with the network cable physically unplugged. Offline use was simulated by blocking internet access inside the app.
