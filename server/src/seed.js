import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from './models/User.js';
import CreditPolicy from './models/CreditPolicy.js';

await mongoose.connect(process.env.MONGODB_URI);

const accounts = [
  ['SUPER_ADMIN', 'SEED_ADMIN_EMAIL', 'SEED_ADMIN_PASSWORD', 'System Super Admin', ''],
  ['FACULTY', 'SEED_FACULTY_EMAIL', 'SEED_FACULTY_PASSWORD', 'Demo Faculty', process.env.SEED_FACULTY_DEPARTMENT || 'Computer Science'],
  ['STUDENT', 'SEED_STUDENT_EMAIL', 'SEED_STUDENT_PASSWORD', 'Demo Student', process.env.SEED_FACULTY_DEPARTMENT || 'Computer Science'],
];

for (const [role, emailKey, passKey, name, department] of accounts) {
  const email = process.env[emailKey]?.toLowerCase();
  const password = process.env[passKey];
  if (!email || !password) { console.log(`Skipping ${role}: ${emailKey}/${passKey} not configured`); continue; }
  if (password.length < 10) { console.log(`Skipping ${role}: password must be at least 10 characters`); continue; }
  if (await User.exists({ email })) { console.log(`${role} account already exists: ${email}`); continue; }
  await User.create({ name, email, role, department, passwordHash: await bcrypt.hash(password, 12) });
  console.log(`Created ${role}: ${email}`);
}

if (!(await CreditPolicy.exists({ active: true }))) {
  await CreditPolicy.create({ name: 'Starter sample policy (replace with institutional rules)', weeksPerCredit: 4, minimumScore: 0, maxCreditsPerStudent: 20 });
  console.log('Created starter credit policy');
}
console.log('Seed complete. Change seed passwords immediately after first login.');
await mongoose.disconnect();
