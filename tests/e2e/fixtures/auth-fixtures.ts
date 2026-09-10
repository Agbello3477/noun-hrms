import { Page, BrowserContext } from '@playwright/test';

export interface MockUserSession {
  id: string;
  email: string;
  name: string;
  role: string;
  token: string;
  staffProfile?: {
    rank?: string;
    department?: string;
    extension?: string;
    cadre?: string;
    level?: number;
    step?: number;
  };
}

export const MOCK_USERS = {
  registryAdmin: {
    id: 'user-registry-001',
    email: 'registry@university.edu',
    name: 'Registry Administrator',
    role: 'HR_ADMIN',
    token: 'jwt-mock-token-registry-admin-001',
    staffProfile: {
      rank: 'Senior Assistant Registrar',
      department: 'Registry HQ',
      extension: '1001',
      cadre: 'ADMINISTRATIVE',
      level: 13,
      step: 4
    }
  } as MockUserSession,

  clinicDoctor: {
    id: 'user-clinic-002',
    email: 'doctor@university.edu',
    name: 'Dr. Amina Yusuf',
    role: 'CLINIC_DOCTOR',
    token: 'jwt-mock-token-clinic-doctor-002',
    staffProfile: {
      rank: 'Principal Medical Officer',
      department: 'University Health Services',
      extension: '1002',
      cadre: 'MEDICAL',
      level: 14,
      step: 2
    }
  } as MockUserSession,

  bursaryOfficer: {
    id: 'user-bursary-003',
    email: 'finance@university.edu',
    name: 'Bursary Finance Director',
    role: 'BURSARY',
    token: 'jwt-mock-token-bursary-003',
    staffProfile: {
      rank: 'Chief Accountant',
      department: 'Bursary Department',
      extension: '1003',
      cadre: 'ADMINISTRATIVE',
      level: 15,
      step: 5
    }
  } as MockUserSession,

  securityOfficer: {
    id: 'user-security-004',
    email: 'security@university.edu',
    name: 'Officer Emeka Obi',
    role: 'SECURITY_OFFICER',
    token: 'jwt-mock-token-security-004',
    staffProfile: {
      rank: 'Senior Patrol Officer',
      department: 'Security Unit',
      extension: '1004',
      cadre: 'SECURITY',
      level: 8,
      step: 3
    }
  } as MockUserSession
};

/**
 * Injects mock authentication state directly into the browser tab's sessionStorage
 * ensuring tab-isolated testing without relying on backend database state.
 */
export async function injectSessionStorageAuth(page: Page, user: MockUserSession): Promise<void> {
  await page.addInitScript(
    ({ mockUser, mockToken }) => {
      window.sessionStorage.setItem('token', mockToken);
      window.sessionStorage.setItem('noun_hrms_user_cache', JSON.stringify(mockUser));
      window.sessionStorage.setItem('user', JSON.stringify(mockUser));
      window.localStorage.setItem('noun_extension_prompt_dismissed', 'true');
    },
    { mockUser: user, mockToken: user.token }
  );
}

/**
 * Sets up route mocks for auth and bootstrap analytics endpoints
 * so tests can run deterministically in CI environments.
 */
export async function setupAuthRouteMocks(page: Page, user: MockUserSession): Promise<void> {
  // Mock login endpoint
  await page.route('**/api/auth/login', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        token: user.token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          staffProfile: user.staffProfile
        }
      })
    });
  });

  // Mock profile endpoint
  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        staffProfile: user.staffProfile
      })
    });
  });

  // Mock dashboard bootstrap endpoint
  await page.route('**/api/analytics/dashboard-bootstrap', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        emergencyHotlines: {
          clinicEmergencyPhone: '+234 803 123 4567',
          securityControlRoomPhone: '+234 803 765 4321'
        },
        notifications: [],
        unreadNotificationsCount: 0,
        analytics: {
          totalWorkforce: 1250,
          activeDuty: 1180,
          activeLeaves: 70,
          pendingActions: 12
        },
        activeLeavesCount: 70,
        activeDutyCount: 1180,
        pendingActionsCount: 12,
        activities: []
      })
    });
  });

  // Mock notifications endpoint
  await page.route('**/api/notifications*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        notifications: [],
        unreadCount: 0
      })
    });
  });

  // Mock VoIP endpoints
  await page.route('**/api/voip/my-extension', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        extension: user.staffProfile?.extension || '1001'
      })
    });
  });

  await page.route('**/api/voip/directory', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'voip-1',
          userId: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          rank: user.staffProfile?.rank || 'Staff',
          extension: user.staffProfile?.extension || '1001',
          department: user.staffProfile?.department || 'Registry HQ',
          status: 'AVAILABLE'
        },
        {
          id: 'voip-2',
          userId: 'user-clinic-002',
          name: 'Dr. Amina Yusuf',
          email: 'doctor@university.edu',
          role: 'CLINIC_DOCTOR',
          rank: 'Principal Medical Officer',
          extension: '1002',
          department: 'University Health Services',
          status: 'AVAILABLE'
        }
      ])
    });
  });

  await page.route('**/api/voip/voicemails', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([])
    });
  });

  await page.route('**/api/voip/ice-servers', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      })
    });
  });
}
