# NOUN HRMS Enterprise Extension — Zero-Touch Automatic Installation Guide

This document provides instructions for **NOUN IT Administrators** to configure **automatic silent installation (Zero-Touch Deployment)** of the NOUN HRMS Desktop Companion Chrome Extension on all staff, faculty, and university-managed workstations.

---

## Method 1: Google Workspace Admin Console (Recommended for all `@noun.edu.ng` accounts)

When staff log into Google Chrome with their university email (`*@noun.edu.ng`), Google Workspace automatically pushes and installs the extension into their Chrome browser silently.

### Steps:
1. Log in to the [Google Workspace Admin Console](https://admin.google.com) with Super Admin privileges.
2. Navigate to:  
   **Devices** → **Chrome** → **Apps & extensions** → **Users & browsers**.
3. Select the target Organizational Unit (e.g. `Faculty & Academic Staff`, `Registry & HR`, or Top-level `NOUN`).
4. Click the yellow **`+` (Add)** button in the bottom right corner and choose:
   - **Add Chrome app or extension by ID** (or from Chrome Web Store).
5. Set the **Installation Policy** dropdown to:
   - **Force install** (or **Force install + pin to browser toolbar**).
6. Click **Save**.

> **Result**: Within minutes, any faculty or staff member signed into Chrome on any computer will automatically receive the NOUN HRMS Desktop Companion extension in their toolbar without having to click anything.

---

## Method 2: Windows Active Directory Group Policy (GPO / Intune)

For university-managed Windows desktop and laptop PCs across Study Centers:

### Registry Configuration:
Add the extension ID and update URL to the Chrome `ExtensionInstallForcelist` policy key:

```reg
Windows Registry Editor Version 5.00

[HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Google\Chrome\ExtensionInstallForcelist]
"1"="[EXTENSION_ID];https://clients2.google.com/service/update2/crx"
```

---

## Method 3: macOS Configuration Profiles (Jamf / Apple MDM)

For university Mac computers:

```xml
<key>ExtensionInstallForcelist</key>
<array>
    <string>[EXTENSION_ID];https://clients2.google.com/service/update2/crx</string>
</array>
```

---

## Method 4: In-Portal First-Login Auto-Detection (For Personal / Unmanaged Computers)

For staff accessing the web portal from personal computers or outside the university network:
- The NOUN HRMS web portal automatically detects if the user has the extension installed upon logging in.
- If not installed, a **1-Click Companion Activation Prompt** appears on their dashboard guiding them to activate it in under 10 seconds.
- As soon as the extension is present, it automatically authenticates with the user's active session without requiring manual logins.
