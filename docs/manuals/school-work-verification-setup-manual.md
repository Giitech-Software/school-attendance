# School / Workplace Verification Setup Manual

Version: 1.0  
Prepared for: ASTEM Attendance  
Scope: Admin page only - School/Workplace Verification Setup

This manual explains how to configure attendance presence verification using GPS, institution WiFi BSSID, and a campus/workplace network verification server.

This document is not added to the app. It is a standalone guide for administrators and technical support.

## 1. What The Verification Page Does

The setup page is available from:

Admin -> Presence Verification

Depending on the tenant type, the page title appears as:

- School Verification Setup
- Workplace Verification Setup

Both use the same verification engine. The difference is only the wording shown to the tenant.

The page controls how the app decides whether a user is physically present before an attendance check-in or check-out is accepted.

## 2. Verification Methods Available

The page supports these modes:

1. Campus network + GPS
2. Campus + WiFi + GPS
3. Campus network only
4. WiFi BSSID + GPS
5. WiFi BSSID only
6. GPS geofence only
7. Disabled / emergency

The app tries the selected methods in order. For example, "Campus + WiFi + GPS" tries campus server first, then WiFi BSSID, then GPS.

## 3. Recommended Mode

Recommended general setting:

Campus + WiFi + GPS

Why:

- Campus server is fastest when the device is on the institution network.
- WiFi BSSID can verify a trusted access point on mobile devices.
- GPS remains a fallback when campus/WiFi verification is unavailable.

Recommended simpler setting:

GPS geofence only

Use this when there is no campus server and WiFi BSSID collection is not ready.

## 4. Important Platform Notes

Web browser:

- GPS works if the browser has location permission.
- Campus server verification works if the browser can reach the campus server URL.
- WiFi BSSID verification is currently not available in normal browser mode. The web service returns that WiFi BSSID is unavailable in the browser.

Mobile app:

- GPS works through device foreground location permission.
- WiFi BSSID works through the device network information API when the device and OS allow it.
- WiFi BSSID still requires location permission on mobile because most mobile operating systems protect WiFi identity as location-sensitive data.
- Campus server verification works if the mobile device can reach the campus server URL.

## 5. GPS Geofence Setup

GPS geofence requires:

- Latitude
- Longitude
- Radius in meters

### How To Configure GPS

1. Go to Admin -> Presence Verification.
2. Select "GPS geofence only" or a mode with GPS fallback.
3. Stand at the center of the accepted attendance area.
4. Click "Use current browser location".
5. Review the loaded latitude and longitude.
6. Enter a radius in meters.
7. Click "Save settings".

### Recommended Radius

Small office:

- 50m to 100m

School compound:

- 100m to 250m

Large campus:

- 250m to 500m, depending on the site boundary

Avoid using a radius that is too small indoors. GPS can drift inside buildings.

### How GPS Is Checked

When attendance is recorded:

- The app reads the user's current location.
- It calculates the distance from the saved latitude/longitude.
- It compares that distance with the saved radius.
- The app adds a limited accuracy buffer, capped at 120 meters, to reduce false rejection caused by poor GPS accuracy.

Mobile GPS is stricter:

- The mobile app samples location multiple times.
- It prefers accurate samples.
- If accuracy is too poor, the user may be asked to move to an open area and try again.

## 6. WiFi BSSID Setup

WiFi BSSID verification checks whether the device is connected to an approved institution WiFi access point.

Important:

- BSSID is not the same as SSID.
- SSID is the WiFi name users see.
- BSSID is the unique hardware address of the WiFi access point.

Example:

SSID:

ASTEM Staff WiFi

BSSID:

aa:bb:cc:dd:ee:ff

### WiFi BSSID Field Format

Enter one access point per line:

```text
BSSID, SSID, Label
aa:bb:cc:dd:ee:ff, ASTEM Staff WiFi, Main Office
11:22:33:44:55:66, ASTEM Staff WiFi, Admin Block
```

BSSID is required. SSID and label are optional.

The app normalizes BSSID values:

- Lowercase is accepted.
- Uppercase is accepted.
- Hyphen format is converted to colon format.

These are treated the same:

```text
AA-BB-CC-DD-EE-FF
aa:bb:cc:dd:ee:ff
```

### How To Collect BSSID Values

Android:

1. Connect to the institution WiFi.
2. Open WiFi details/settings.
3. Look for BSSID, Router MAC, Access point MAC, or similar wording.
4. Record the exact value.

Windows:

1. Connect to the institution WiFi.
2. Open Command Prompt.
3. Run:

```text
netsh wlan show interfaces
```

4. Find the BSSID line.

macOS:

1. Hold Option and click the WiFi icon.
2. Read the BSSID value from the network details.

Router/controller:

- For managed WiFi systems, get BSSID values from the access point/controller dashboard.

### How To Configure WiFi Verification

1. Go to Admin -> Presence Verification.
2. Select "WiFi BSSID + GPS" or "Campus + WiFi + GPS".
3. Enter trusted BSSID lines in the Institution WiFi BSSID box.
4. Keep GPS latitude/longitude/radius configured as a fallback unless using WiFi-only mode.
5. Click "Save settings".

### WiFi-Only Warning

Use "WiFi BSSID only" carefully.

If a device cannot read the BSSID, attendance will fail. This is especially important on:

- Web browsers
- Some iOS versions
- Devices with location permission disabled
- Devices not connected to WiFi

For most institutions, use "WiFi BSSID + GPS" instead of WiFi-only.

## 7. Campus Network Server Setup

Campus network verification uses a local or institution-controlled server to confirm that a device is on the trusted campus/workplace network.

The setup page expects:

- Campus server URL
- Verification endpoint
- Pairing endpoint
- Institution ID
- Server name
- Setup code

Default endpoints:

```text
Pairing endpoint: /pair
Verification endpoint: /verify-attendance
```

Example base URL:

```text
http://attendance.local
```

or

```text
https://attendance.example.edu
```

### How Campus Verification Works

1. Admin pairs the app with the campus server using a one-time setup code.
2. The app saves the returned server details.
3. During attendance, the app calls the verification endpoint.
4. The server confirms whether the request is allowed.
5. If approved, the attendance record stores campus verification audit details.

### Pairing Request Expected By The App

The app sends a POST request to:

```text
{Campus server URL}{Pairing endpoint}
```

Example:

```text
http://attendance.local/pair
```

Request body:

```json
{
  "setupCode": "ONE_TIME_CODE",
  "institutionId": "institution_001",
  "requestedBy": "admin_user_uid",
  "requestedAt": "2026-07-10T04:00:00.000Z"
}
```

Expected successful response:

```json
{
  "ok": true,
  "baseUrl": "http://attendance.local",
  "tokenEndpoint": "/verify-attendance",
  "pairEndpoint": "/pair",
  "institutionId": "institution_001",
  "serverName": "Campus attendance server",
  "publicKey": null,
  "pairedAt": "2026-07-10T04:00:00.000Z"
}
```

If the response is not OK, return:

```json
{
  "ok": false,
  "message": "Invalid setup code."
}
```

### Attendance Verification Request Expected By The App

The app sends a POST request to:

```text
{Campus server URL}{Verification endpoint}
```

Example:

```text
http://attendance.local/verify-attendance
```

Headers:

```text
Content-Type: application/json
Authorization: Bearer FIREBASE_ID_TOKEN
```

Request body:

```json
{
  "uid": "firebase_user_uid",
  "email": "user@example.com",
  "institutionId": "institution_001",
  "nonce": "unique-request-value",
  "requestedAt": "2026-07-10T04:00:00.000Z",
  "platform": "web"
}
```

Mobile sends:

```json
{
  "platform": "mobile"
}
```

Expected successful response:

```json
{
  "ok": true,
  "serverName": "Campus attendance server",
  "institutionId": "institution_001",
  "expiresAt": "2026-07-10T04:05:00.000Z"
}
```

Expected failed response:

```json
{
  "ok": false,
  "message": "Device is not on the approved campus network."
}
```

### Campus Server Timeout

The app waits about 2.5 seconds for campus server verification.

If campus server is used with GPS fallback, the app can continue to GPS if the server fails.

If campus server only is selected, attendance fails when the server is unreachable.

### Campus Server Network Requirements

The campus server must be reachable by the user's device.

For local-only networks:

- Use a local DNS name such as http://attendance.local, or a fixed local IP address.
- Make sure phones and computers are on the same trusted network.
- Make sure firewall rules allow POST requests to the pairing and verification endpoints.

For HTTPS/public domain:

- Use a valid TLS certificate.
- Ensure CORS allows the web app origin if the browser calls the server.
- Keep the verification endpoint protected.

## 8. How To Configure Campus Server Mode

1. Go to Admin -> Presence Verification.
2. Enter Campus server URL.
3. Confirm Verification endpoint, usually /verify-attendance.
4. Confirm Pairing endpoint, usually /pair.
5. Enter Institution ID if used by your organization.
6. Enter Server name.
7. Enter the one-time Setup code from the campus server.
8. Click "Pair verification server".
9. Wait for "Verification server paired. Save settings to activate it."
10. Select the desired mode:
    - Campus network + GPS
    - Campus + WiFi + GPS
    - Campus network only
11. Click "Save settings".

## 9. Emergency Bypass

Emergency bypass disables geofencing and allows attendance without GPS/campus/WiFi checks.

Use it only when verification is temporarily unavailable.

The page supports these bypass durations:

- Day: until 11:59 PM today
- Week: 7 calendar days
- Month: 1 calendar month
- Term: until current term ends
- Year: 1 calendar year

To enable:

1. Enter a clear emergency bypass reason.
2. Select duration.
3. Click "Disable geofencing".
4. Confirm the prompt.

To restore:

1. Click "Re-enable geofencing".

Audit note:

Attendance records during bypass are marked with geofence bypass information.

## 10. What Gets Stored On Attendance Records

Depending on the method used, attendance records can include:

GPS:

- Verification method: gps
- Latitude
- Longitude
- Accuracy meters
- Distance from configured location
- Allowed distance
- Radius

Campus server:

- Verification method: campus_network
- Campus server verified flag
- Server name
- Institution ID
- Token expiry time

WiFi BSSID:

- Verification method: wifi_bssid
- WiFi verified flag
- BSSID
- SSID
- Label

Bypass:

- Verification method: geofence_bypass
- Bypass reason
- Bypassed by
- Bypass expiry

## 11. Recommended Setup Combinations

### School With Reliable Internet And Campus WiFi

Use:

Campus + WiFi + GPS

Configure:

- GPS latitude/longitude/radius
- Campus server
- WiFi BSSIDs for main access points

### Small School Without Campus Server

Use:

WiFi BSSID + GPS

Configure:

- GPS latitude/longitude/radius
- WiFi BSSIDs for trusted routers

If mobile BSSID is unreliable, use:

GPS geofence only

### Office / Workplace Tenant

Use:

Campus + WiFi + GPS

or:

GPS geofence only

Avoid school-only wording when training users. The setup page will display "Workplace" for non-school tenants.

### Strict Controlled Site

Use:

Campus network only

Only use this when:

- Campus server is highly reliable.
- All attendance devices can reach it.
- There is support available if the server goes down.

## 12. Testing Checklist

After setup, test with an admin and a normal user.

GPS test:

1. Stand inside the configured area.
2. Record attendance.
3. Confirm attendance succeeds.
4. Move outside the radius.
5. Try again and confirm it is rejected.

WiFi test:

1. Connect mobile device to approved WiFi.
2. Record attendance.
3. Confirm attendance succeeds.
4. Disconnect from WiFi or connect to unapproved WiFi.
5. Confirm attendance falls back to GPS or fails, depending on selected mode.

Campus server test:

1. Connect device to the campus network.
2. Record attendance.
3. Confirm campus verification succeeds.
4. Disconnect from campus network.
5. Confirm fallback or rejection based on selected mode.

Emergency bypass test:

1. Enable bypass for Day.
2. Record attendance.
3. Confirm attendance succeeds and stores bypass audit details.
4. Re-enable geofencing.
5. Confirm normal verification is restored.

## 13. Troubleshooting

Problem:

School/workplace location not configured.

Fix:

- Enter valid latitude, longitude, and radius.
- Save settings.

Problem:

Could not get current location.

Fix:

- Allow location permission.
- Turn on GPS/location services.
- Move near a window or open area.
- Try again.

Problem:

User is outside premises.

Fix:

- Confirm user is physically inside the site.
- Confirm the saved latitude/longitude are correct.
- Increase the radius if the institution compound is larger.

Problem:

WiFi BSSID is not available.

Fix:

- Use the mobile app where supported.
- Grant location permission.
- Connect to WiFi.
- Use GPS fallback or campus server.
- Do not rely on WiFi-only mode for web browsers.

Problem:

Device is not connected to approved institution WiFi.

Fix:

- Confirm the device is on the correct WiFi.
- Confirm the router/access point BSSID is entered correctly.
- Add all campus access point BSSIDs, not just the SSID.

Problem:

Campus server did not respond in time.

Fix:

- Confirm the server is online.
- Confirm the base URL and endpoint are correct.
- Confirm the device can reach the server.
- Check firewall and DNS.
- Use a fallback mode such as Campus network + GPS.

Problem:

Campus server pairing failed.

Fix:

- Confirm the setup code is correct and unused.
- Confirm /pair endpoint is working.
- Confirm Institution ID matches the server configuration.

## 14. Admin Safety Rules

- Always keep GPS configured as a fallback unless you are sure campus/WiFi verification is reliable.
- Avoid "Campus network only" or "WiFi BSSID only" during early rollout.
- Record every trusted WiFi access point BSSID.
- Test on both web and mobile before requiring staff to use a strict mode.
- Use emergency bypass only for temporary outages.
- Re-enable geofencing immediately after the issue is resolved.

## 15. Quick Setup Template

Use this template for a normal rollout:

```text
Mode: Campus + WiFi + GPS
Latitude: [captured from site center]
Longitude: [captured from site center]
Radius: 150
Campus server URL: http://attendance.local
Verification endpoint: /verify-attendance
Pairing endpoint: /pair
Institution ID: institution_001
Server name: Campus attendance server
WiFi BSSID list:
aa:bb:cc:dd:ee:ff, Institution WiFi, Main Office
11:22:33:44:55:66, Institution WiFi, Admin Block
```

Then:

1. Pair verification server.
2. Save settings.
3. Test campus verification.
4. Test WiFi verification on mobile.
5. Test GPS fallback.
6. Train users to allow location permission.

