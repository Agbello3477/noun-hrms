export interface LeaveSession {
    id: string;
    title: string;
    year: number;
    startDate: string; // ISO Date
    endDate: string; // ISO Date
    isActive: boolean;
    reminder7DaysSentAt?: string | null;
    reminderClosingDaySentAt?: string | null;
    reminder2HoursSentAt?: string | null;
    createdAt: string;
    updatedAt: string;
}
