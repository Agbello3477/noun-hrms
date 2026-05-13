
export interface AperSession {
    id: string;
    title: string;
    year: number;
    startDate: string; // ISO Date
    endDate: string; // ISO Date
    isActive: boolean;
    createdAt: string;
}

export enum AperStatus {
    DRAFT = 'DRAFT',
    SUBMITTED = 'SUBMITTED',
    REVIEWED = 'REVIEWED',
    COMPLETED = 'COMPLETED'
}

export interface AperForm {
    id: string;
    staffId: string;
    sessionId: string;
    scores: any; // Use a more specific type if possible later
    comments: any;
    status: AperStatus;
    supervisorId?: string;
    createdAt: string;
    updatedAt: string;
    // Relations
    session?: AperSession;
    staff?: any; // StaffProfile
}
