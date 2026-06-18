# M'Salem Attendance Register: User Manual

Version 1.2 Expanded Edition

For Administrators, Teachers, Staff, and Parents

## Brand And Status Colours

M'Salem uses a simple colour language throughout the app and this manual.

| Colour | Meaning | Where You See It |
|---|---|---|
| Navy | Main headers and admin areas | Admin dashboard, page headers |
| Blue | Primary action | Save, download, setup, continue |
| Green | Success or ready | Attendance ready, successful check-in |
| Amber | Warning or attention | GPS accuracy, pending setup |
| Red | Blocked, danger, or disabled | Delete, blocked attendance, geofence bypass |
| Slate | Neutral information | Descriptions, secondary text |

## 1. Welcome To M'Salem Attendance Register

M'Salem Attendance Register is an all-in-one school attendance system designed to make attendance fast, secure, traceable, and easy to report. It supports student attendance, staff attendance, parent visibility, reports, user approvals, QR cards, biometrics, face recognition, school location protection, and administrative setup.

Depending on your school's setup, attendance can be recorded using:

- **QR Codes**: scan a printed or digital student/staff card.
- **Fingerprint/Biometric**: use the phone or tablet's biometric prompt.
- **Face Recognition**: use the device camera to match a registered face.
- **Staff ID**: manually type a staff ID when other methods are unavailable.

The goal is simple: the right person records the right attendance at the right place and time.

### System Overview Diagram

```text
                 M'SALEM ATTENDANCE REGISTER
                            |
        ------------------------------------------------
        |              |              |                |
     Users          Setup        Attendance         Reports
        |              |              |                |
 Admin approval   Terms/classes   QR / face / ID    Daily
 Roles/rights     Staff/students   Biometric         Weekly
 Parent wards     Location rules   Check-in/out      Monthly
                                  Geofence audit     Termly
```

### Who Uses The App?

| User Type | Main Purpose |
|---|---|
| Administrator | Configure the school, approve users, manage records, export reports |
| Teacher | Take attendance for assigned classes when permitted |
| Staff | Check in/out and view own attendance when enabled |
| Parent | View attendance for assigned children |
| Supervised attendance taker | Record attendance for students or staff when explicitly permitted |

## 2. Getting Into Your Account

### Signing In

1. Open the app on your phone, tablet, or computer.
2. Enter your registered email address and password.
3. Tap **Sign In**.

If sign-in is successful, the app opens your home page based on your role and approval status.

### Common Sign-In Messages

| Message | Meaning | What To Do |
|---|---|---|
| Email not verified | Your email address has not been confirmed | Open your inbox and verify your email |
| Account pending approval | A school admin has not approved your account yet | Contact your school administrator |
| No internet | The app cannot reach the server | Turn on mobile data or Wi-Fi and try again |
| Invalid credentials | Email or password is incorrect | Check spelling or reset your password |

### Creating A New Account

1. Tap **Create account** on the login screen.
2. Enter your full name.
3. Choose your role, such as Teacher or Parent.
4. Enter your email address.
5. Create and confirm your password.
6. Verify your email from your inbox.
7. Wait for a school administrator to approve your account.

New accounts cannot use protected school data until they are approved.

### Resetting A Forgotten Password

1. Tap **Forgot password?** on the sign-in screen.
2. Type your email address.
3. Tap **Send reset link**.
4. Open your email inbox and follow the reset instructions.

### Verifying Your Email

If the verification email does not appear immediately:

- Check your inbox.
- Check spam or junk.
- Tap **Resend verification email** in the app.
- After clicking the email link, return to the app and tap **I verified - Check now**.

### Account Access Flow

```text
Create account
      |
Verify email
      |
Admin reviews user
      |
Approved? ---- No ----> Pending Approval screen
      |
     Yes
      |
Home page opens with role-based tools
```

## 3. Getting Around The Home Page

The Home page is the main working dashboard. What you see depends on your role and permissions.

### Main Buttons

| Button | Purpose |
|---|---|
| QR | Opens the camera scanner for student or staff QR cards |
| Biometric | Opens fingerprint/biometric attendance |
| Facial | Opens face recognition attendance |
| ID | Allows staff attendance by typing staff ID |
| Start | Lets you choose Student Attendance or Staff Attendance |
| Reports | Opens reports for administrators |
| Admin | Opens setup and management tools |
| Add Student | Quickly adds a student |
| Select Actor | Switches between Student and Staff tasks |
| Sign out | Safely logs out |

### Home Page Decision Diagram

```text
Home Page
   |
   |-- Need to take attendance?
   |      |-- Student -> Select class -> Choose QR / biometric / face
   |      |-- Staff   -> Choose QR / biometric / face / ID
   |
   |-- Need setup?
   |      |-- Admin -> Terms / classes / users / location / settings
   |
   |-- Need reports?
          |-- Reports -> Daily / weekly / monthly / termly
```

## 4. How To Take Attendance

Attendance can be taken for students or staff. The app checks time rules, user permissions, and location rules before saving records.

### Taking Student Attendance

Go to **Start > Student Attendance** or tap **QR** on the Home page.

1. Select the class.
2. Choose an attendance method:
   - **Student Biometric Attendance**: tap **Check-In** or **Check-Out** beside the student and use the device biometric prompt.
   - **Scan QR Code (In)**: use for morning arrival.
   - **Scan QR Code (Out)**: use for dismissal.
   - **Student Face Check-In**: use where student face registration is enabled.
3. Wait for the success confirmation before moving to the next student.

### Taking Staff Attendance

Go to **Start > Staff Attendance**, or use **Biometric**, **Facial**, **QR**, or **ID** from the Home page.

1. Choose a method:
   - **Staff Biometric Attendance**.
   - **Scan QR Code (In)** or **Scan QR Code (Out)**.
   - **Staff Face Check-In**.
   - **Staff ID Attendance**.
2. Follow the on-screen prompt.
3. Confirm that the success message appears.

### Attendance Save Flow

```text
User selects attendance method
          |
App checks account permission
          |
App checks date/time rules
          |
App checks school location or bypass policy
          |
Record is created or updated
          |
Reports and daily views are updated
```

### Important Attendance Rules

- Attendance may be blocked on weekends or configured holidays.
- Check-ins after the configured late time are marked **Late**.
- Check-in is blocked after the configured close time.
- Check-out remains available after close time for people who already checked in.
- Geofencing checks that the device is inside the approved school/work radius.
- If geofencing is bypassed, only administrators or users with explicit attendance-taking permission can record attendance.
- Staff self-service and assigned-class-only attendance are blocked while geofencing is bypassed.

### Emergency Bypass Rule

If GPS, weather, or rural internet conditions make geofencing unreliable, an administrator may temporarily disable geofencing. During this period:

- Only admins or users with **Can take student attendance** can record student attendance.
- Only admins or users with **Can take staff attendance** can record staff attendance.
- Staff cannot simply check in from home using self-service.
- Every bypassed record is audited with reason, admin, expiry, and timestamp.

### QR Scanner

When the scanner opens, the top of the screen shows **Scan Student QR** or **Scan Staff QR**.

- Tap **Check-in** or **Check-out** to choose the attendance mode.
- Point the camera at the QR card.
- After success, tap **Scan Again** for the next person.
- Tap **Done**, **Back**, or **Cancel** to exit.

### Today's Attendance

The Today's Attendance page lists current-day records, including check-in and check-out times.

## 5. Administrative Controls

The Admin dashboard is the control centre for school setup, permissions, attendance configuration, and records.

### Admin Dashboard Tools

| Tool | Purpose |
|---|---|
| Attendance Readiness | Shows whether location/geofencing is ready, blocked, or bypassed |
| Set School/Work Location | Saves GPS coordinates, radius, and geofencing policy |
| Bypass Options | Temporarily disables geofencing for a selected duration |
| Manage Terms | Creates school terms and weeks |
| Manage Students | Adds, edits, imports, or deletes students |
| Manage Staff | Adds, edits, imports, or deletes staff |
| Promote Students | Moves students to a new class without deleting history |
| Students QR Cards | Generates printable student QR cards |
| Staff QR Cards | Generates staff QR cards |
| Manage Classes | Creates and edits classes |
| Manage Users | Approves users, changes roles, and assigns permissions |
| Assign Students To Classes | Assigns or moves students into classes |
| Attendance Time | Sets late time, close time, and timezone |
| User Manual | Opens this guide and Word download |

### Attendance Readiness Diagram

```text
Admin Dashboard
      |
Attendance Readiness
      |
      |-- Ready -> Normal attendance allowed with GPS checks
      |
      |-- Blocked -> Set school/work location or choose bypass
      |
      |-- Emergency Mode -> GPS bypass active, audited records only
```

### Recommended Admin Routine

1. Approve legitimate users.
2. Create terms and weeks.
3. Create classes.
4. Add students and staff.
5. Assign students to classes.
6. Set attendance time and timezone.
7. Set school/work location.
8. Generate QR cards.
9. Review daily reports.

## 6. Setting Up The School Year And Classes

### Managing School Terms

Go to **Admin > Manage Terms**.

- **Add Term**: enter the term name, start date, and end date.
- **Auto-Generate Weeks**: creates weekly attendance periods automatically.
- **Edit**: update term details.
- **Delete**: remove a term after confirmation.

Dates should use `YYYY-MM-DD`, for example `2026-05-20`.

### Managing Classes

Go to **Admin > Manage Classes**.

- Tap **Add** to create a class such as Basic 1 or Form 2.
- Add an optional description.
- Use **Edit** to update class details.
- Use **Delete** only when you are sure the class is no longer needed.

### Assigning Students To Classes

Go to **Admin > Assign Students to Classes**.

1. Select a class.
2. Search for a student.
3. Tap:
   - **Assign** to add the student.
   - **Assigned** to remove the student.
   - **Move** to move the student from another class.

### Promoting Students

Go to **Admin > Promote Students**.

1. Choose the source class.
2. Choose the target class.
3. Select active students.
4. Tap **Promote Selected**.

Promotion updates current class placement. It does not delete old attendance records.

### Academic Setup Flow

```text
Create term
    |
Generate weeks
    |
Create classes
    |
Add/import students
    |
Assign students to classes
    |
Promote students at end of year/term
```

## 7. Managing Student Profiles

Go to **Admin > Manage Students** or tap **Add Student**.

### Student List

Use search to find a student by:

- Name.
- Student ID.
- Roll number.
- Class.

Student cards show key identity and enrollment information.

### Student Actions

| Action | Purpose |
|---|---|
| Edit | Update student details |
| Delete | Remove a student after confirmation |
| Import | Add many students from CSV |
| Enroll | Register biometric/fingerprint |
| Register Face | Save face profile for face attendance |
| QR Generator | Create QR cards |

### Registering A Student

Enter:

- Full name.
- Class.
- Optional student ID.
- Optional roll number.

Tap **Create student**.

### Bulk Student Import

Go to **Admin > Manage Students > Import**.

Paste CSV rows with matching headers:

```csv
name,className,studentId,rollNo
Ama Mensah,Basic 1,STU001,1
Kofi Addo,Basic 1,STU002,2
```

The importer checks class names and avoids duplicate student IDs or roll numbers where possible.

### Student Biometric Enrollment

1. Open the student's profile.
2. Tap **Enroll Biometric**.
3. Confirm the student name.
4. Tap **Enroll fingerprint / biometric**.
5. Complete the device biometric prompt.

### Student Face Registration

1. Open student face registration.
2. Grant camera permission.
3. Place the student in good light.
4. Tap **Capture Face**.

### Student QR Cards

Go to **Admin > Students QR Cards**.

- Search for a student.
- Tap the student to view a QR code.
- Use **Copy JSON** or **Share PNG** for a digital copy.
- Use **Export PDF** to print QR cards for a class.

### Student Data Flow

```text
Create/import student
        |
Assign to class
        |
Enroll QR / biometric / face
        |
Take attendance
        |
Reports show history
```

## 8. Managing Staff Profiles

Go to **Admin > Manage Staff**.

### Staff List And Colour Codes

| Colour | Meaning |
|---|---|
| Red | No face or fingerprint enrollment |
| Amber | Partly enrolled |
| Green | Face and fingerprint enrolled |

### Adding Staff

Staff can be added in three ways:

- **Create Staff**: manually enter name, staff ID, email, and role.
- **Bulk Import**: paste CSV rows with `name,email,role,staffId`.
- **Register Staff From User**: connect an existing app user to a staff record.

### Staff Bulk Import Example

```csv
name,email,role,staffId
Kofi Boateng,kofi@example.com,Teacher,STA001
Akua Owusu,akua@example.com,Non-Teaching,STA002
```

### Staff Face And Biometric Setup

1. Open the staff profile.
2. Register face with the camera.
3. Enroll biometric/fingerprint after face setup.
4. Confirm the staff card shows the correct enrollment status.

### Staff Self-Service

When enabled, staff can use:

- **My Attendance** to view daily check-in/out.
- **My Report** to view their own attendance report.

Self-service is disabled during geofencing bypass unless the staff user also has explicit attendance-taking permission.

## 9. Managing App Users And Parents

### Managing Users

Go to **Admin > Manage Users**.

Admins can:

- Search users by name, email, or role.
- Approve or unapprove accounts.
- Change roles.
- Delete users after confirmation.
- Enable **Can take student attendance**.
- Enable **Can take staff attendance**.
- Assign parent wards.

### User Role Guide

| Role | Typical Access |
|---|---|
| Admin | Full school setup and reports |
| Teacher | Assigned classes and permitted attendance actions |
| Staff | Staff attendance and own records |
| Parent | Assigned child attendance view |
| General staff | Staff workflows based on permissions |

### Parent Wards

Go to **Manage Users > Wards** for a parent.

1. Search for a student.
2. Tap **Assign** to connect the student to the parent.
3. Tap **Assigned** to remove.
4. Tap **Move** if the student belongs to a different parent account.

### Parent View

Parents see **My Wards**.

- They can view daily, weekly, monthly, or term attendance.
- They cannot edit attendance.
- They cannot access admin setup.

### User Permission Diagram

```text
New user signs up
       |
Admin approves
       |
Admin chooses role
       |
Optional attendance permissions
       |
User sees role-based pages only
```

## 10. Setting Up School Attendance Times

Go to **Admin > Go to Attendance Time**.

### Attendance Time Fields

| Field | Purpose | Example |
|---|---|---|
| Late Check-In Time | After this time, check-ins are marked late | `08:00` |
| Attendance Close Time | After this time, new check-ins are blocked | `10:00` |
| Timezone | Used to calculate school time correctly | `Africa/Accra` |

Use 24-hour time, such as `08:30` or `15:45`.

### Time Rule Diagram

```text
Before late time       -> Present
After late time        -> Late
After close time       -> Check-in blocked
Already checked in     -> Check-out still allowed
```

## 11. School/Work Location And Geofencing

Go to **Admin > Set School/Work Location**.

This page controls:

- School latitude.
- School longitude.
- Allowed radius in meters.
- GPS accuracy review.
- Geofencing status.
- Emergency bypass duration.
- Re-enable geofencing.

### Attendance Readiness

The Admin dashboard shows:

| Status | Meaning | Action |
|---|---|---|
| Ready | Location is configured and geofencing is active | Attendance can proceed |
| Blocked | Location is missing or invalid | Set location or choose bypass |
| Emergency Mode | Geofencing is disabled temporarily | Only authorized attendance takers can record |

### Setting The Location

1. Stand in a clear open area on the school compound.
2. Open **Set School/Work Location**.
3. Review latitude, longitude, radius, and GPS accuracy.
4. Tap **Refresh GPS Location** if the first reading is poor.
5. Tap **Set School/Work Location**.

Saving a valid location automatically re-enables geofencing and clears any old bypass.

### Choosing A Practical Radius

Choose a radius that covers the school compound, not only the exact spot where the admin is standing.

| School Layout | Suggested Starting Radius |
|---|---|
| Small compound | 80-120 meters |
| Medium compound | 120-200 meters |
| Large campus | 200-400 meters |

Adjust based on real testing and GPS accuracy.

### Geofencing Bypass

Use bypass only when the school cannot reliably use GPS, such as:

- Rural internet problems.
- Device GPS instability.
- Bad weather affecting GPS readings.
- Temporary setup or location-service issues.

Admins choose a duration:

| Duration | Expiry |
|---|---|
| Day | End of today |
| Week | Seven calendar days |
| Month | One calendar month |
| Term | Current term end date |
| Year | One calendar year |

The Term option requires a current term with a valid future end date.

### Bypass Security Rule

During bypass:

- Student attendance requires admin or **Can take student attendance**.
- Staff attendance requires admin or **Can take staff attendance**.
- Staff self-service is blocked.
- Assigned-class-only attendance is blocked unless explicit permission is also granted.
- Each record is audited with bypass reason, admin, expiry, and timestamp.

### Geofencing Diagram

```text
Normal Mode
  User device GPS
        |
  Inside school radius? ---- No ----> Attendance blocked
        |
       Yes
        |
  Attendance allowed if user has permission

Bypass Mode
  GPS check skipped
        |
  User has explicit can-take-attendance permission?
        |---- No ----> Attendance blocked
        |
       Yes
        |
  Attendance saved with bypass audit
```

## 12. Understanding School Reports

Reports are for administrators and management.

Go to **Reports**, then choose **Student Reports** or **Staff Reports**.

### Report Types

| Report | Use |
|---|---|
| Daily Attendance | See one day of attendance |
| Weekly Reports | Review a week |
| Monthly Reports | Review attendance across a month |
| Termly Reports | Review a full term |
| Individual Student Report | View one student's history |
| Individual Staff Report | View one staff member's history |

### Report Keys

| Key | Meaning |
|---|---|
| P | Present |
| L | Late |
| A | Absent |
| Attended | Present plus Late |
| Attendance % | Attendance rate for the selected period |

### Report Workflow

```text
Open Reports
     |
Choose Student or Staff
     |
Choose daily / weekly / monthly / termly
     |
Filter by date, class, or person
     |
Review summary
     |
Export PDF if needed
```

## 13. Downloading And Sharing The Manual

Admins can open **Admin > User Manual**.

- Read the manual inside the app.
- Tap **Download Word Manual** to share or save the `.docx` file.
- If the sharing sheet does not appear, restart the app and try again.
- If the app was recently updated, the developer may need to restart Expo with cache cleared so the Word asset is bundled.

## 14. Quick Troubleshooting Guide

| Issue | What Is Happening | What To Do |
|---|---|---|
| Cannot sign in | Wrong credentials or email is unverified | Check spelling, reset password, or verify email |
| No internet error | Device is offline | Turn on mobile data or Wi-Fi |
| Account pending | Admin has not approved the user | Ask admin to approve the account |
| Camera blocked | App does not have camera permission | Enable camera permission in device settings |
| Biometric unavailable | Device biometric is not ready | Set up fingerprint/face unlock on the device |
| Location unavailable | GPS cannot get a reliable position | Enable precise location and move near a window or outdoors |
| Too far from school | Device is outside geofence | Move onto campus or ask admin to review radius |
| Attendance readiness blocked | Location setup is missing | Admin should set school/work location or choose bypass |
| Geofencing bypass active | GPS is temporarily disabled | Only explicit attendance takers can record attendance |
| Check-in closed | Close time has passed | Use check-out only if already checked in |
| QR code not accepted | QR is wrong, damaged, or mismatched | Confirm QR belongs to the right student/staff and class |
| Parent sees no children | No wards assigned | Admin should assign wards to the parent |
| Word manual will not download | File sharing or asset cache issue | Restart app or ask developer to clear Expo cache |

## 15. Best Practices

### For Administrators

- Review pending users daily.
- Keep terms, weeks, classes, and staff records current.
- Set school location before the first attendance day.
- Test geofencing with multiple devices.
- Use bypass only when necessary and always provide a clear reason.
- Export reports regularly.

### For Teachers And Staff

- Confirm the correct class or attendance mode before scanning.
- Wait for the success message before moving to the next person.
- Report QR, GPS, camera, or biometric issues quickly.
- Do not share your login.

### For Parents

- Use the parent account linked to your child's records.
- Contact the school if a ward is missing.
- Use reports as attendance visibility, not as an editing tool.

## 16. Page Coverage

| Area | Pages Covered |
|---|---|
| Auth | Sign In, Create Account, Forgot Password, Verify Email, Pending Approval |
| Home | Main dashboard, quick actions, actor selection |
| Attendance | Student/Staff Attendance, QR Scanner, Today's Attendance, Staff ID, Face Check-In |
| Admin | Admin dashboard, User Manual, School/Work Location, Attendance Time |
| Setup | Terms, Weeks, Classes, Class Assignment, Promote Students |
| Students | Student list, Create, Edit, Bulk Import, QR Generator, Face/Biometric Enrollment |
| Staff | Staff list, Create, Edit, Bulk Import, QR Cards, Face/Biometric Enrollment, My Attendance |
| Users | Manage Users, Edit User, Parent Wards |
| Reports | Daily, Weekly, Monthly, Termly, Student Detail, Staff Detail |
