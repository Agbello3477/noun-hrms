import { Request, Response } from 'express';
import prisma from '../prisma';
import PDFDocument from 'pdfkit';

/**
 * GET /api/v1/registry/reports/disciplinary-leave-audit
 * Disciplinary & Leave Audit Report Generator (PDF, CSV, JSON)
 */
export const getDisciplinaryLeaveAuditReport = async (req: Request, res: Response) => {
    try {
        const { format = 'json', startDate, endDate, unitId, actionType, leaveType } = req.query;

        const dateFilter: any = {};
        if (startDate) dateFilter.gte = new Date(String(startDate));
        if (endDate) dateFilter.lte = new Date(String(endDate));

        const queryWhere: any = {};
        if (Object.keys(dateFilter).length > 0) queryWhere.createdAt = dateFilter;
        if (actionType) queryWhere.actionType = String(actionType);
        if (unitId) queryWhere.staff = { unitId: String(unitId) };

        const leaveWhere: any = {};
        if (Object.keys(dateFilter).length > 0) leaveWhere.createdAt = dateFilter;
        if (leaveType) leaveWhere.type = String(leaveType);
        if (unitId) leaveWhere.staff = { unitId: String(unitId) };

        const [queries, leaves] = await Promise.all([
            prisma.staffQuery.findMany({
                where: queryWhere,
                include: {
                    staff: {
                        include: {
                            user: { select: { name: true, email: true } },
                            unit: { select: { name: true } }
                        }
                    },
                    issuedBy: { select: { name: true, email: true } }
                },
                orderBy: { createdAt: 'desc' }
            }),
            prisma.leaveRequest.findMany({
                where: leaveWhere,
                include: {
                    staff: {
                        include: {
                            user: { select: { name: true, email: true } },
                            unit: { select: { name: true } }
                        }
                    },
                    approvedBy: { select: { name: true } }
                },
                orderBy: { createdAt: 'desc' }
            })
        ]);

        const disciplinaryData = queries.map(q => ({
            id: q.id,
            staffName: q.staff?.user?.name || `${q.staff?.surname || ''} ${q.staff?.otherNames || ''}`.trim() || 'N/A',
            staffId: q.staff?.staffId || 'N/A',
            unit: q.staff?.unit?.name || 'Central Directorate',
            title: q.title,
            actionType: q.actionType,
            status: q.status,
            source: q.source,
            stipulatedHours: q.stipulatedHours,
            slaBreached: q.slaBreached,
            resolutionStatus: q.resolutionStatus,
            issuedBy: q.issuedBy?.name || 'Registry HR',
            createdAt: q.createdAt.toISOString(),
            responseDeadline: q.responseDeadline ? q.responseDeadline.toISOString() : null
        }));

        const leaveData = leaves.map(l => ({
            id: l.id,
            staffName: l.staff?.user?.name || `${l.staff?.surname || ''} ${l.staff?.otherNames || ''}`.trim() || 'N/A',
            staffId: l.staff?.staffId || 'N/A',
            unit: l.staff?.unit?.name || 'Central Directorate',
            type: l.type,
            status: l.status,
            startDate: l.startDate.toISOString().split('T')[0],
            endDate: l.endDate.toISOString().split('T')[0],
            durationDays: l.durationDays,
            reason: l.reason,
            turnaroundTimeHours: l.turnaroundTimeHours,
            slaBreach: l.slaBreach,
            approvedBy: l.approvedBy?.name || 'Pending',
            createdAt: l.createdAt.toISOString()
        }));

        if (format === 'csv') {
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename="disciplinary-leave-audit-report.csv"');

            let csv = 'SECTION: DISCIPLINARY ACTIONS\n';
            csv += 'ID,Staff Name,Staff ID,Unit,Title,Action Type,Status,SLA Breached,Resolution,Issued By,Date\n';
            disciplinaryData.forEach(d => {
                csv += `"${d.id}","${d.staffName}","${d.staffId}","${d.unit}","${d.title.replace(/"/g, '""')}","${d.actionType}","${d.status}","${d.slaBreached}","${d.resolutionStatus}","${d.issuedBy}","${d.createdAt}"\n`;
            });

            csv += '\nSECTION: LEAVE REQUESTS & SLA\n';
            csv += 'ID,Staff Name,Staff ID,Unit,Leave Type,Status,Start Date,End Date,Duration Days,SLA Breached,Turnaround Hours,Approved By,Date\n';
            leaveData.forEach(l => {
                csv += `"${l.id}","${l.staffName}","${l.staffId}","${l.unit}","${l.type}","${l.status}","${l.startDate}","${l.endDate}","${l.durationDays}","${l.slaBreach}","${l.turnaroundTimeHours || 'N/A'}","${l.approvedBy}","${l.createdAt}"\n`;
            });

            return res.send(csv);
        }

        if (format === 'pdf') {
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment; filename="disciplinary-leave-audit-report.pdf"');

            const doc = new PDFDocument({ margin: 40, size: 'A4' });
            doc.pipe(res);

            // Header
            doc.fontSize(18).text('NATIONAL OPEN UNIVERSITY OF NIGERIA', { align: 'center' });
            doc.fontSize(13).text('Central Registry — Official Disciplinary & Leave Audit Report', { align: 'center' });
            doc.moveDown(0.5);
            doc.fontSize(9).text(`Generated On: ${new Date().toLocaleString('en-NG', { timeZone: 'Africa/Lagos' })} | Total Disciplinary: ${disciplinaryData.length} | Total Leaves: ${leaveData.length}`, { align: 'center' });
            doc.moveDown(1);

            // Disciplinary Section
            doc.fontSize(12).fillColor('#8B0000').text('1. DISCIPLINARY RECORDS & SLA COMPLIANCE', { underline: true });
            doc.fillColor('#000000').fontSize(9).moveDown(0.5);

            if (disciplinaryData.length === 0) {
                doc.text('No disciplinary records match the selected timeframe.');
            } else {
                disciplinaryData.slice(0, 30).forEach((d, idx) => {
                    doc.text(`${idx + 1}. [${d.actionType}] ${d.staffName} (${d.staffId}) — Unit: ${d.unit}`);
                    doc.text(`   Subject: ${d.title} | Status: ${d.status} | SLA Breached: ${d.slaBreached ? 'YES' : 'NO'} | Resolution: ${d.resolutionStatus}`);
                    doc.moveDown(0.3);
                });
                if (disciplinaryData.length > 30) {
                    doc.text(`... and ${disciplinaryData.length - 30} more records.`);
                }
            }

            doc.moveDown(1);

            // Leave Section
            doc.fontSize(12).fillColor('#003366').text('2. LEAVE APPLICATIONS & SLA RESOLUTION', { underline: true });
            doc.fillColor('#000000').fontSize(9).moveDown(0.5);

            if (leaveData.length === 0) {
                doc.text('No leave request records match the selected timeframe.');
            } else {
                leaveData.slice(0, 30).forEach((l, idx) => {
                    doc.text(`${idx + 1}. [${l.type}] ${l.staffName} (${l.staffId}) — ${l.durationDays} days (${l.startDate} to ${l.endDate})`);
                    doc.text(`   Status: ${l.status} | SLA Breach: ${l.slaBreach ? 'YES' : 'NO'} | Turnaround: ${l.turnaroundTimeHours ? l.turnaroundTimeHours.toFixed(1) + ' hrs' : 'N/A'}`);
                    doc.moveDown(0.3);
                });
                if (leaveData.length > 30) {
                    doc.text(`... and ${leaveData.length - 30} more records.`);
                }
            }

            doc.end();
            return;
        }

        res.json({
            summary: {
                totalDisciplinary: disciplinaryData.length,
                totalQueries: disciplinaryData.filter(d => d.actionType === 'QUERY').length,
                totalWarnings: disciplinaryData.filter(d => d.actionType === 'OFFICIAL_WARNING').length,
                totalDisciplinaryBreaches: disciplinaryData.filter(d => d.slaBreached).length,
                totalLeaves: leaveData.length,
                totalLeaveBreaches: leaveData.filter(l => l.slaBreach).length
            },
            disciplinary: disciplinaryData,
            leaves: leaveData
        });
    } catch (error: any) {
        console.error('Error generating disciplinary leave audit report:', error);
        res.status(500).json({ message: 'Internal server error generating report', error: error.message });
    }
};

function formatDuration(startDate: Date, endDate: Date): string {
    const diffMs = endDate.getTime() - startDate.getTime();
    if (diffMs <= 0) return 'Immediate';
    const totalDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const totalMonths = Math.floor(totalDays / 30.44);
    const years = Math.floor(totalMonths / 12);
    const months = totalMonths % 12;

    if (years > 0) {
        return `${years} yr${years > 1 ? 's' : ''} ${months > 0 ? `${months} mo${months > 1 ? 's' : ''}` : ''}`.trim();
    }
    if (months > 0) {
        return `${months} mo${months > 1 ? 's' : ''}`;
    }
    return `${totalDays} day${totalDays > 1 ? 's' : ''}`;
}

/**
 * GET /api/v1/registry/reports/staff-movement-audit
 * Staff File Creation & Transfer Movement Audit Report Generator (PDF, CSV, JSON)
 */
export const getStaffMovementAuditReport = async (req: Request, res: Response) => {
    try {
        const { format = 'json', startDate, endDate, unitId, centerId, employmentCategory } = req.query;

        const dateFilter: any = {};
        if (startDate) dateFilter.gte = new Date(String(startDate));
        if (endDate) dateFilter.lte = new Date(String(endDate));

        const staffWhere: any = { isDeleted: false };
        if (Object.keys(dateFilter).length > 0) staffWhere.createdAt = dateFilter;
        if (employmentCategory) staffWhere.employmentCategory = String(employmentCategory);
        if (unitId) staffWhere.unitId = String(unitId);
        if (centerId) staffWhere.centerId = String(centerId);

        const transferWhere: any = {};
        if (Object.keys(dateFilter).length > 0) transferWhere.createdAt = dateFilter;

        const [createdStaff, transfers, units, centers, allHistoricalTransfers] = await Promise.all([
            prisma.staffProfile.findMany({
                where: staffWhere,
                include: {
                    user: { select: { name: true, email: true, role: true } },
                    unit: { select: { id: true, name: true } },
                    studyCenter: { select: { id: true, name: true } },
                    createdBy: { select: { name: true, email: true } }
                },
                orderBy: { createdAt: 'desc' }
            }),
            prisma.transferLog.findMany({
                where: transferWhere,
                include: {
                    staff: { select: { id: true, name: true, email: true, staffProfile: { select: { id: true, staffId: true, rank: true, createdAt: true } } } },
                    initiatedBy: { select: { name: true, email: true } },
                    authorizedBy: { select: { name: true, email: true } },
                    oldUnit: { select: { id: true, name: true } },
                    newUnit: { select: { id: true, name: true } }
                },
                orderBy: { createdAt: 'desc' }
            }),
            prisma.unit.findMany({ select: { id: true, name: true } }),
            prisma.studyCenter.findMany({ select: { id: true, name: true } }),
            prisma.transferLog.findMany({
                where: { status: { in: ['APPROVED', 'AUTHORIZED'] } },
                select: { staffId: true, effectiveDate: true, createdAt: true },
                orderBy: { effectiveDate: 'asc' }
            })
        ]);

        const locationMap = new Map<string, string>();
        units.forEach(u => locationMap.set(u.id, u.name));
        centers.forEach(c => locationMap.set(c.id, c.name));

        // Group previous transfers by staff user ID to calculate duration at previous post
        const transferHistoryMap = new Map<string, Date[]>();
        allHistoricalTransfers.forEach(t => {
            const list = transferHistoryMap.get(t.staffId) || [];
            list.push(new Date(t.effectiveDate || t.createdAt));
            transferHistoryMap.set(t.staffId, list);
        });

        const staffCreationData = createdStaff.map(s => ({
            id: s.id,
            staffName: s.user?.name || `${s.surname || ''} ${s.otherNames || ''}`.trim() || 'N/A',
            staffId: s.staffId || 'N/A',
            email: s.user?.email || 'N/A',
            role: s.user?.role || 'STAFF',
            cadre: s.cadre || s.cadreType || 'N/A',
            rank: s.rank || 'N/A',
            level: s.level || 'N/A',
            step: s.step || '1',
            unit: s.unit?.name || s.studyCenter?.name || 'Central Registry',
            unitId: s.unitId || s.centerId || '',
            employmentCategory: s.employmentCategory,
            accountStatus: s.accountStatus,
            imputerName: s.createdBy?.name || 'System Initializer',
            registrarAuthorizationDate: s.clearedAt ? s.clearedAt.toISOString().split('T')[0] : (s.accountStatus === 'CLEARED_ACTIVE' || s.accountStatus === 'ACTIVE' ? s.createdAt.toISOString().split('T')[0] : 'Pending Registrar Clearance'),
            createdAt: s.createdAt.toISOString()
        }));

        const transferData = transfers.map(t => {
            const origin = t.oldUnit?.name || locationMap.get(t.oldCenterId || '') || t.oldCenterId || 'Unassigned';
            const destination = t.newUnit?.name || locationMap.get(t.newCenterId || '') || t.newCenterId || 'Unknown';
            const originId = t.oldUnitId || t.oldCenterId || '';
            const destinationId = t.newUnitId || t.newCenterId || '';

            // Compute Duration at Previous Post
            let durationAtPreviousPost = 'Initial Posting';
            const currentEffective = new Date(t.effectiveDate || t.createdAt);
            const staffCreateDate = t.staff?.staffProfile?.createdAt ? new Date(t.staff.staffProfile.createdAt) : null;
            const pastDates = transferHistoryMap.get(t.staffId) || [];

            // Find latest transfer before current
            const earlierDates = pastDates.filter(d => d < currentEffective).sort((a, b) => b.getTime() - a.getTime());
            if (earlierDates.length > 0) {
                durationAtPreviousPost = formatDuration(earlierDates[0], currentEffective);
            } else if (staffCreateDate && staffCreateDate < currentEffective) {
                durationAtPreviousPost = formatDuration(staffCreateDate, currentEffective);
            }

            return {
                id: t.id,
                staffName: t.staff?.name || 'N/A',
                staffId: t.staff?.staffProfile?.staffId || 'N/A',
                rank: t.staff?.staffProfile?.rank || 'N/A',
                origin,
                destination,
                originId,
                destinationId,
                durationAtPreviousPost,
                status: t.status,
                relocationAllowance: t.relocationAllowance,
                relocationAllowanceAmount: t.relocationAllowanceAmount || 0,
                imputerName: t.initiatedBy?.name || 'Registry Imputer',
                authorizerSignature: t.digitalSignatureRef || (t.authorizedBy?.name ? `DIGITAL_SIG_${t.authorizedBy.name.toUpperCase().replace(/\s+/g, '_')}` : 'PENDING_REGISTRAR_SIGNATURE'),
                authorizedByName: t.authorizedBy?.name || 'Pending Registrar Authorization',
                authorizedAt: t.authorizedAt ? t.authorizedAt.toISOString() : null,
                effectiveDate: t.effectiveDate.toISOString().split('T')[0],
                createdAt: t.createdAt.toISOString()
            };
        });

        // Compute Center-by-Center Movement Summary
        const centerSummaryMap = new Map<string, {
            centerId: string;
            centerName: string;
            newFilesCreated: number;
            transfersIn: number;
            transfersOut: number;
            netMovement: number;
            pendingArrivals: number;
        }>();

        // Seed with all known centers & units
        centers.forEach(c => {
            centerSummaryMap.set(c.id, {
                centerId: c.id,
                centerName: c.name,
                newFilesCreated: 0,
                transfersIn: 0,
                transfersOut: 0,
                netMovement: 0,
                pendingArrivals: 0
            });
        });
        units.forEach(u => {
            centerSummaryMap.set(u.id, {
                centerId: u.id,
                centerName: u.name,
                newFilesCreated: 0,
                transfersIn: 0,
                transfersOut: 0,
                netMovement: 0,
                pendingArrivals: 0
            });
        });

        // Aggregate New Files
        staffCreationData.forEach(s => {
            if (s.unitId && centerSummaryMap.has(s.unitId)) {
                const entry = centerSummaryMap.get(s.unitId)!;
                entry.newFilesCreated += 1;
                entry.netMovement += 1;
            }
        });

        // Aggregate Transfers
        transferData.forEach(t => {
            if (t.destinationId && centerSummaryMap.has(t.destinationId)) {
                const destEntry = centerSummaryMap.get(t.destinationId)!;
                if (t.status === 'APPROVED' || t.status === 'AUTHORIZED') {
                    destEntry.transfersIn += 1;
                    destEntry.netMovement += 1;
                } else if (t.status === 'PENDING_REGISTRAR_AUTHORIZATION') {
                    destEntry.pendingArrivals += 1;
                }
            }
            if (t.originId && centerSummaryMap.has(t.originId)) {
                const origEntry = centerSummaryMap.get(t.originId)!;
                if (t.status === 'APPROVED' || t.status === 'AUTHORIZED') {
                    origEntry.transfersOut += 1;
                    origEntry.netMovement -= 1;
                }
            }
        });

        const centerMovementSummary = Array.from(centerSummaryMap.values())
            .filter(c => c.newFilesCreated > 0 || c.transfersIn > 0 || c.transfersOut > 0 || c.pendingArrivals > 0)
            .sort((a, b) => Math.abs(b.netMovement) - Math.abs(a.netMovement) || b.newFilesCreated - a.newFilesCreated);

        if (format === 'csv') {
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename="staff-movement-audit-report.csv"');

            let csv = 'SECTION 1: NEW STAFF FILES CREATED & ONBOARDING\n';
            csv += 'Timestamp,Staff Name,Staff ID,Imputer Name,Registrar Authorization Date,Contract Type,Cadre,Rank,Starting Level,Starting Step,Unit / Center,Account Status\n';
            staffCreationData.forEach(s => {
                csv += `"${s.createdAt}","${s.staffName}","${s.staffId}","${s.imputerName}","${s.registrarAuthorizationDate}","${s.employmentCategory}","${s.cadre}","${s.rank}","${s.level}","${s.step}","${s.unit}","${s.accountStatus}"\n`;
            });

            csv += '\nSECTION 2: TRANSFER & POSTING MATRIX\n';
            csv += 'Timestamp,Staff Name,Staff ID,Rank,Origin,Destination,Duration at Previous Post,Imputer,Authorizing Registrar,Authorizer Signature/Ref,Registrar Authorization Date,Effective Date,Status\n';
            transferData.forEach(t => {
                csv += `"${t.createdAt}","${t.staffName}","${t.staffId}","${t.rank}","${t.origin}","${t.destination}","${t.durationAtPreviousPost}","${t.imputerName}","${t.authorizedByName}","${t.authorizerSignature}","${t.authorizedAt || 'Pending'}","${t.effectiveDate}","${t.status}"\n`;
            });

            csv += '\nSECTION 3: CENTER-BY-CENTER MOVEMENT SUMMARY\n';
            csv += 'Study Center / Directorate,New Files Created,Transfers In,Transfers Out,Net Delta (+/-),Pending Incoming Transfers\n';
            centerMovementSummary.forEach(c => {
                csv += `"${c.centerName}",${c.newFilesCreated},${c.transfersIn},${c.transfersOut},${c.netMovement},${c.pendingArrivals}\n`;
            });

            return res.send(csv);
        }

        if (format === 'pdf') {
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment; filename="staff-movement-audit-report.pdf"');

            const doc = new PDFDocument({ margin: 40, size: 'A4' });
            doc.pipe(res);

            // Header
            doc.fontSize(16).text('NATIONAL OPEN UNIVERSITY OF NIGERIA', { align: 'center' });
            doc.fontSize(12).text('Central Registry — Staff File Creation & Transfer Movement Audit Report', { align: 'center' });
            doc.moveDown(0.5);
            doc.fontSize(8).text(`Generated: ${new Date().toLocaleString('en-NG', { timeZone: 'Africa/Lagos' })} | New Files: ${staffCreationData.length} | Postings: ${transferData.length} | Active Movement Centers: ${centerMovementSummary.length}`, { align: 'center' });
            doc.moveDown(1);

            // Center Movement Summary Table
            doc.fontSize(11).fillColor('#004d40').text('1. CENTER-BY-CENTER MOVEMENT SUMMARY', { underline: true });
            doc.fillColor('#000000').fontSize(8).moveDown(0.5);

            if (centerMovementSummary.length === 0) {
                doc.text('No movement activity recorded in this period.');
            } else {
                centerMovementSummary.slice(0, 15).forEach(c => {
                    doc.text(`• ${c.centerName}: +${c.newFilesCreated} New Files | +${c.transfersIn} Inflows | -${c.transfersOut} Outflows | Net: ${c.netMovement >= 0 ? '+' : ''}${c.netMovement} (Pending: ${c.pendingArrivals})`);
                });
                if (centerMovementSummary.length > 15) {
                    doc.text(`... and ${centerMovementSummary.length - 15} more operational locations.`);
                }
            }

            doc.moveDown(1);

            // Staff Creation Section
            doc.fontSize(11).fillColor('#003366').text('2. NEW STAFF FILES CREATED & REGISTRAR CLEARANCES', { underline: true });
            doc.fillColor('#000000').fontSize(8).moveDown(0.5);

            if (staffCreationData.length === 0) {
                doc.text('No staff file creation records found for the selected timeframe.');
            } else {
                staffCreationData.slice(0, 20).forEach((s, idx) => {
                    doc.text(`${idx + 1}. ${s.staffName} (${s.staffId}) — [${s.employmentCategory}] Unit: ${s.unit}`);
                    doc.text(`   Level/Step: ${s.level} / Step ${s.step} | Rank: ${s.rank} | Imputer: ${s.imputerName} | Registrar Auth: ${s.registrarAuthorizationDate}`);
                    doc.moveDown(0.2);
                });
                if (staffCreationData.length > 20) {
                    doc.text(`... and ${staffCreationData.length - 20} more records.`);
                }
            }

            doc.moveDown(1);

            // Transfers Section
            doc.fontSize(11).fillColor('#8B0000').text('3. TRANSFER & POSTING MATRIX (DUAL-CONTROL AUDIT)', { underline: true });
            doc.fillColor('#000000').fontSize(8).moveDown(0.5);

            if (transferData.length === 0) {
                doc.text('No transfer/posting records found for the selected timeframe.');
            } else {
                transferData.slice(0, 20).forEach((t, idx) => {
                    doc.text(`${idx + 1}. ${t.staffName} (${t.staffId}) — ${t.origin} ➔ ${t.destination}`);
                    doc.text(`   Duration at Prev Post: ${t.durationAtPreviousPost} | Status: ${t.status} | Imputer: ${t.imputerName} | Signature Ref: ${t.authorizerSignature} | Effective: ${t.effectiveDate}`);
                    doc.moveDown(0.2);
                });
                if (transferData.length > 20) {
                    doc.text(`... and ${transferData.length - 20} more records.`);
                }
            }

            doc.end();
            return;
        }

        res.json({
            summary: {
                totalStaffCreated: staffCreationData.length,
                permanentStaff: staffCreationData.filter(s => s.employmentCategory === 'PERMANENT').length,
                contractStaff: staffCreationData.filter(s => s.employmentCategory === 'CONTRACT').length,
                nyscCorpers: staffCreationData.filter(s => s.employmentCategory === 'NYSC_CORPERS').length,
                volunteers: staffCreationData.filter(s => s.employmentCategory === 'VOLUNTEER').length,
                totalTransfers: transferData.length,
                authorizedTransfers: transferData.filter(t => t.status === 'APPROVED' || t.status === 'AUTHORIZED').length,
                pendingTransfers: transferData.filter(t => t.status === 'PENDING_REGISTRAR_AUTHORIZATION').length,
                activeMovementCentersCount: centerMovementSummary.length
            },
            staffCreations: staffCreationData,
            transfers: transferData,
            centerMovementSummary
        });
    } catch (error: any) {
        console.error('Error generating staff movement audit report:', error);
        res.status(500).json({ message: 'Internal server error generating report', error: error.message });
    }
};
