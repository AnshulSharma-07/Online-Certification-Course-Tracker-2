import 'dotenv/config';
import app from './app.js';
import connectDB from './config/db.js';
import { validateEnv } from './config/env.js';

const port = process.env.PORT || 5000;
try {
  validateEnv();
  await connectDB();
  const server = app.listen(port, () => console.log(`API listening on http://localhost:${port}`));
  for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.close(() => process.exit(0)));
} catch (error) {
  console.error('Startup failed:', error.message);
  process.exit(1);
}
process.on('unhandledRejection', (reason) => console.error('Unhandled rejection:', reason));
