import http from 'k6/http';
import { check, sleep } from 'k6';

// k6 Load Test Configuration simulating enterprise concurrency (50,000+ VUs)
export const options = {
    stages: [
        { duration: '1m', target: 5000 },   // Ramp-up to 5,000 users
        { duration: '2m', target: 20000 },  // Ramp-up to 20,000 users
        { duration: '5m', target: 50000 },  // Peak load: 50,000 virtual users simultaneously
        { duration: '2m', target: 10000 },  // Ramp-down to 10,000 users
        { duration: '1m', target: 0 },      // Cooldown
    ],
    thresholds: {
        http_req_failed: ['rate<0.01'],    // Under 1% request failures allowed
        http_req_duration: ['p(95)<1000'], // 95% of requests must complete under 1s at massive scale
    },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:5055';

export default function () {
    const headers = { 'Content-Type': 'application/json' };

    // 1. Simulation: Core API Authentication (POST /api/auth/login)
    const loginPayload = JSON.stringify({
        email: `staff-${__VU}@noun.edu.ng`, // Distributed unique logins
        password: 'password123',
    });

    const loginRes = http.post(`${BASE_URL}/api/auth/login`, loginPayload, { headers });
    
    const loginSuccess = check(loginRes, {
        'login successful (200)': (r) => r.status === 200,
        'has token response': (r) => {
            try {
                return JSON.parse(r.body).token !== undefined;
            } catch (e) {
                return false;
            }
        }
    });

    if (!loginSuccess) {
        sleep(1);
        return;
    }

    const token = JSON.parse(loginRes.body).token;
    const authHeaders = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
    };

    // 2. Simulation: View Profile (GET /api/staff/me)
    const profileRes = http.get(`${BASE_URL}/api/staff/me`, { headers: authHeaders });
    check(profileRes, {
        'profile retrieval successful (200)': (r) => r.status === 200,
    });

    sleep(1);

    // 3. Simulation: Clock-in action (POST /api/attendance/clock-in)
    const clockInPayload = JSON.stringify({
        latitude: 9.0765,  // Coordinates centered around Abuja, Nigeria
        longitude: 7.3986,
    });

    const clockInRes = http.post(`${BASE_URL}/api/attendance/clock-in`, clockInPayload, { headers: authHeaders });
    check(clockInRes, {
        'clock-in recorded (200/201)': (r) => r.status === 200 || r.status === 201,
    });

    sleep(2);

    // 4. Simulation: View Payroll History (GET /api/payroll)
    const payrollRes = http.get(`${BASE_URL}/api/payroll`, { headers: authHeaders });
    check(payrollRes, {
        'payroll history loaded (200)': (r) => r.status === 200,
    });

    // Pacing interval between loops to simulate human actions
    sleep(Math.random() * 3 + 2);
}
