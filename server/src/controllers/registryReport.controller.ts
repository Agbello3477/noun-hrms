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

/**
 * GET /api/v1/registry/reports/staff-movement-audit
 * Staff File Creation & Transfer Movement Audit Report Generator (PDF, CSV, JSON)
 */
export const getStaffMovementAuditReport = async (req: Request, res: Response) => {
    try {
        const { format = 'json', startDate, endDate, unitId, employmentCategory } = req.query;

        const dateFilter: any = {};
        if (startDate) dateFilter.gte = new Date(String(startDate));
        if (endDate) dateFilter.lte = new Date(String(endDate));

        const staffWhere: any = { isDeleted: false };
        if (Object.keys(dateFilter).length > 0) staffWhere.createdAt = dateFilter;
        if (employmentCategory) staffWhere.employmentCategory = String(employmentCategory);
        if (unitId) staffWhere.unitId = String(unitId);

        const transferWhere: any = {};
        if (Object.keys(dateFilter).length > 0) transferWhere.createdAt = dateFilter;

        const [createdStaff, transfers, units, centers] = await Promise.all([
            prisma.staffProfile.findMany({
                where: staffWhere,
                include: {
                    user: { select: { name: true, email: true, role: true } },
                    unit: { select: { name: true } },
                    studyCenter: { select: { name: true } },
                    createdBy: { select: { name: true, email: true } }
                },
                orderBy: { createdAt: 'desc' }
            }),
            prisma.transferLog.findMany({
                where: transferWhere,
                include: {
                    staff: { select: { name: true, email: true, staffProfile: { select: { staffId: true, rank: true } } } },
                    initiatedBy: { select: { name: true, email: true } },
                    authorizedBy: { select: { name: true, email: true } },
                    oldUnit: { select: { name: true } },
                    newUnit: { select: { name: true } }
                },
                orderBy: { createdAt: 'desc' }
            }),
            prisma.unit.findMany({ select: { id: true, name: true } }),
            prisma.studyCenter.findMany({ select: { id: true, name: true } })
        ]);

        const locationMap = new Map<string, string>();
        units.forEach(u => locationMap.set(u.id, u.name));
        centers.forEach(c => locationMap.set(c.id, c.name));

        const staffCreationData = createdStaff.map(s => ({
            id: s.id,
            staffName: s.user?.name || `${s.surname || ''} ${s.otherNames || ''}`.trim() || 'N/A',
            staffId: s.staffId || 'N/A',
            email: s.user?.email || 'N/A',
            role: s.user?.role || 'STAFF',
            cadre: s.cadre || s.cadreType || 'N/A',
            rank: s.rank || 'N/A',
            unit: s.unit?.name || s.studyCenter?.name || 'Central Registry',
            employmentCategory: s.employmentCategory,
            accountStatus: s.accountStatus,
            imputerName: s.createdBy?.name || 'System Initializer',
            createdAt: s.createdAt.toISOString()
        }));

        const transferData = transfers.map(t => ({
            id: t.id,
            staffName: t.staff?.name || 'N/A',
            staffId: t.staff?.staffProfile?.staffId || 'N/A',
            rank: t.staff?.staffProfile?.rank || 'N/A',
            origin: t.oldUnit?.name || locationMap.get(t.oldCenterId || '') || t.oldCenterId || 'Unassigned',
            destination: t.newUnit?.name || locationMap.get(t.newCenterId || '') || t.newCenterId || 'Unknown',
            status: t.status,
            relocationAllowance: t.relocationAllowance,
            relocationAllowanceAmount: t.relocationAllowanceAmount || 0,
            imputerName: t.initiatedBy?.name || 'Registry Imputer',
            authorizedByName: t.authorizedBy?.name || 'Pending Registrar Authorization',
            authorizedAt: t.authorizedAt ? t.authorizedAt.toISOString() : null,
            effectiveDate: t.effectiveDate.toISOString().split('T')[0],
            createdAt: t.createdAt.toISOString()
        }));

        if (format === 'csv') {
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename="staff-movement-audit-report.csv"');

            let csv = 'SECTION: STAFF FILE CREATIONS & ONBOARDING\n';
            csv += 'ID,Staff Name,Staff ID,Email,Role,Cadre,Rank,Unit,Category,Account Status,Created By,Date\n';
            staffCreationData.forEach(s => {
                csv += `"${s.id}","${s.staffName}","${s.staffId}","${s.email}","${s.role}","${s.cadre}","${s.rank}","${s.unit}","${s.employmentCategory}","${s.accountStatus}","${s.imputerName}","${s.createdAt}"\n`;
            });

            csv += '\nSECTION: STAFF TRANSFERS & POSTINGS\n';
            csv += 'ID,Staff Name,Staff ID,Rank,Origin,Destination,Status,Relocation Allowance,Amount,Imputer,Authorizing Registrar,Effective Date,Created Date\n';
            transferData.forEach(t => {
                csv += `"${t.id}","${t.staffName}","${t.staffId}","${t.rank}","${t.origin}","${t.destination}","${t.status}","${t.relocationAllowance}","${t.relocationAllowanceAmount}","${t.imputerName}","${t.authorizedByName}","${t.effectiveDate}","${t.createdAt}"\n`;
            });

            return res.send(csv);
        }

        if (format === 'pdf') {
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment; filename="staff-movement-audit-report.pdf"');

            const doc = new PDFDocument({ margin: 40, size: 'A4' });
            doc.pipe(res);

            // Header
            doc.fontSize(18).text('NATIONAL OPEN UNIVERSITY OF NIGERIA', { align: 'center' });
            doc.fontSize(13).text('Central Registry — Staff File Creation & Movement Audit Report', { align: 'center' });
            doc.moveDown(0.5);
            doc.fontSize(9).text(`Generated On: ${new Date().toLocaleString('en-NG', { timeZone: 'Africa/Lagos' })} | New Staff Files: ${staffCreationData.length} | Postings: ${transferData.length}`, { align: 'center' });
            doc.moveDown(1);

            // Staff Creation Section
            doc.fontSize(12).fillColor('#004d40').text('1. STAFF FILE CREATION & MAKER-CHECKER CLEARANCE', { underline: true });
            doc.fillColor('#000000').fontSize(9).moveDown(0.5);

            if (staffCreationData.length === 0) {
                doc.text('No staff file creation records found for the selected timeframe.');
            } else {
                staffCreationData.slice(0, 25).forEach((s, idx) => {
                    doc.text(`${idx + 1}. ${s.staffName} (${s.staffId}) — [${s.employmentCategory}] Unit: ${s.unit}`);
                    doc.text(`   Status: ${s.accountStatus} | Rank: ${s.rank} | Imputer: ${s.imputerName} | Created: ${s.createdAt.split('T')[0]}`);
                    doc.moveDown(0.3);
                });
                if (staffCreationData.length > 25) {
                    doc.text(`... and ${staffCreationData.length - 25} more records.`);
                }
            }

            doc.moveDown(1);

            // Transfers Section
            doc.fontSize(12).fillColor('#1a237e').text('2. STAFF POSTINGS & DUAL-CONTROL AUTHORIZATION AUDIT', { underline: true });
            doc.fillColor('#000000').fontSize(9).moveDown(0.5);

            if (transferData.length === 0) {
                doc.text('No transfer/posting records found for the selected timeframe.');
            } else {
                transferData.slice(0, 25).forEach((t, idx) => {
                    doc.text(`${idx + 1}. ${t.staffName} (${t.staffId}) — ${t.origin} ➔ ${t.destination}`);
                    doc.text(`   Status: ${t.status} | Imputer: ${t.imputerName} | Authorizer: ${t.authorizedByName} | Effective: ${t.effectiveDate}`);
                    doc.moveDown(0.3);
                });
                if (transferData.length > 25) {
                    doc.text(`... and ${transferData.length - 25} more records.`);
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
                authorizedTransfers: transferData.filter(t => t.status === 'APPROVED').length,
                pendingTransfers: transferData.filter(t => t.status === 'PENDING_REGISTRAR_AUTHORIZATION').length
            },
            staffCreations: staffCreationData,
            transfers: transferData
        });
    } catch (error: any) {
        console.error('Error generating staff movement audit report:', error);
        res.status(500).json({ message: 'Internal server error generating report', error: error.message });
    }
};
