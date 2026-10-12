import mongoose from 'mongoose';
import app from './app.js';
import { env } from './config/env.js';
import { connectDb } from './config/db.js';

async function main() {
  await connectDb();
  const server = app.listen(env.port, () => {
    console.log(`api listening on port ${env.port}`);
  });

  const shutdown = () => {
    server.close(async () => {
      await mongoose.disconnect();
      process.exit(0);
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
