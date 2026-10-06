import { seedAcademicHierarchy } from '../server/scripts/seed-academic-programmes';

async function run() {
  await seedAcademicHierarchy();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
