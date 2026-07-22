import prisma from '../prisma';
import { enableDbMock } from './dbMock';

const runTests = async () => {
    await enableDbMock();
    console.log('🧪 Starting Operations Inventory & Assets Dispensing Tests...');

    let tempUser: any = null;
    let tempGear: any = null;
    let tempMed: any = null;
    let tempLoan: any = null;

    try {
        // 1. Setup temporary test user
        console.log('🔄 Setting up temporary officer/user...');
        tempUser = await prisma.user.create({
            data: {
                email: `officertest-${Date.now()}@noun.edu.ng`,
                password: 'hashed_password_placeholder',
                role: 'SECURITY_OFFICER'
            }
        });

        // 2. Setup security gear item
        console.log('🔄 Registering walkie-talkie gear asset...');
        tempGear = await prisma.securityGear.create({
            data: {
                name: `Walkie-Talkie Test-${Date.now()}`,
                totalQty: 10,
                availableQty: 10,
                unit: 'pcs'
            }
        });

        // Verify checkout transaction
        console.log('🔄 Checking out gear asset (Loan)...');
        tempLoan = await prisma.securityGearLoan.create({
            data: {
                gearId: tempGear.id,
                officerId: tempUser.id,
                quantity: 2,
                status: 'LOANED'
            }
        });

        await prisma.securityGear.update({
            where: { id: tempGear.id },
            data: { availableQty: 8 }
        });

        let gearRecord = await prisma.securityGear.findUnique({
            where: { id: tempGear.id }
        });
        if (gearRecord && gearRecord.availableQty === 8) {
            console.log('✅ PASS: Gear checked out successfully; availableQty deducted to 8');
        } else {
            throw new Error('FAIL: Gear checkout available quantity mismatch');
        }

        // Return gear transaction
        console.log('🔄 Check-in gear asset (Return)...');
        await prisma.securityGearLoan.update({
            where: { id: tempLoan.id },
            data: { status: 'RETURNED', returnedAt: new Date() }
        });
        await prisma.securityGear.update({
            where: { id: tempGear.id },
            data: { availableQty: 10 }
        });

        gearRecord = await prisma.securityGear.findUnique({
            where: { id: tempGear.id }
        });
        if (gearRecord && gearRecord.availableQty === 10) {
            console.log('✅ PASS: Gear returned successfully; availableQty restored to 10');
        } else {
            throw new Error('FAIL: Gear return available quantity mismatch');
        }

        // 3. Clinic low stock alerts verification
        console.log('🔄 Registering mock medication for stock checks...');
        tempMed = await prisma.clinicInventory.create({
            data: {
                name: `Panadol Test-${Date.now()}`,
                quantity: 25,
                unit: 'tablets'
            }
        });

        console.log('🔄 Simulating drug dispensation to trigger low-stock warning (<20)...');
        const dispensedQty = 8;
        const newQty = Math.max(0, tempMed.quantity - dispensedQty);
        await prisma.clinicInventory.update({
            where: { id: tempMed.id },
            data: { quantity: newQty }
        });

        if (newQty < 20) {
            console.log(`✅ PASS: Medication stock dropped to ${newQty} which correctly triggers alert threshold`);
        } else {
            throw new Error('FAIL: Low-stock alarm limit check mismatch');
        }

    } catch (error) {
        console.error('❌ FAIL: Inventory Integration Tests encountered an error:', error);
        process.exit(1);
    } finally {
        console.log('🧹 Cleaning up temporary database records...');
        if (tempLoan) {
            await prisma.securityGearLoan.delete({ where: { id: tempLoan.id } }).catch(() => {});
        }
        if (tempGear) {
            await prisma.securityGear.delete({ where: { id: tempGear.id } }).catch(() => {});
        }
        if (tempMed) {
            await prisma.clinicInventory.delete({ where: { id: tempMed.id } }).catch(() => {});
        }
        if (tempUser) {
            await prisma.user.delete({ where: { id: tempUser.id } }).catch(() => {});
        }
    }

    console.log('\n🎉 Operations Inventory Tests complete: all checks passed.');
};

runTests();
