# Chrome Web Store Listing: NOUN HRMS Enterprise Companion

## Store Metadata
- **Extension Name**: NOUN HRMS Enterprise Companion
- **Version**: 1.0.0
- **Category**: Productivity / Academic & Enterprise Tools
- **Summary**: Desktop companion for National Open University of Nigeria (NOUN) HRMS: Academic Literature Clipper, Emergency SOS Trigger, and Real-Time VoIP/Call Alerts.
- **Support URL**: https://nounhrms.web.app/dashboard
- **Privacy Policy**: https://nounhrms.web.app/privacy

---

## Detailed Description
The NOUN HRMS Enterprise Companion empowers university faculty, researchers, administrative personnel, and security officers with seamless desktop integration directly connected to the NOUN Enterprise Platform.

### Key Capabilities:
1. **Academic Literature Clipper**:
   - One-click bibliographic metadata extraction (Title, Authors, DOI, Abstract, Journal, Year) from supported academic portals (Google Scholar, PubMed, IEEE Xplore, ScienceDirect).
   - Direct pushing of structured citation cards into your active Research Forum Workspace.
2. **Campus Emergency Quick-Action**:
   - Instant emergency incident reporting into the Security Command Center queue.
   - Categorized reporting (Medical, Intrusion, Fire Hazard, Theft, Suspicious Activity) with optional anonymous filing.
3. **Real-Time VoIP & Call Signaling**:
   - Native desktop notifications for incoming internal VoIP extensions, video conference meetings, and security dispatches.
   - Direct click-to-answer routing straight into the portal workspace.
4. **Seamless Authentication Sync**:
   - Automatically synchronizes with your active authenticated session on nounhrms.web.app.

---

## Permissions Justification
| Permission | Review Justification |
|---|---|
| `storage` | Required to persist user authentication tokens, active research workspace selection, and local extension preferences. |
| `notifications` | Required to display native OS desktop alerts for incoming VoIP calls, video meeting invites, and emergency security broadcasts. |
| `tabs` | Required to detect academic literature pages, query bibliographic title/URL from active tabs, and sync user session from open portal tabs. |
| `scripting` | Required to inject the academic literature extraction script on research publisher sites and synchronize portal tokens. |
| `alarms` | Required for background service worker heartbeat checks to refresh signaling connections and verify session health without keeping memory awake. |

## Host Permissions Justification
| Host Pattern | Justification |
|---|---|
| `https://noun-hrms.onrender.com/*` | Primary enterprise REST API & WebSocket signaling server for authentication, research, and security incident dispatch. |
| `https://nounhrms.web.app/*` | Official enterprise web portal domain for session sync and deep-linking. |
| `*://scholar.google.com/*` | Academic literature metadata extraction for research citations. |
| `*://pubmed.ncbi.nlm.nih.gov/*` | Academic medical/life sciences literature metadata extraction. |
| `*://ieeexplore.ieee.org/*` | Academic computer science & engineering literature extraction. |
| `*://*.sciencedirect.com/*` | Academic journal article metadata extraction. |
| `*://doi.org/*` | Digital Object Identifier resolver page metadata extraction. |
