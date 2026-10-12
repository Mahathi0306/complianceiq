import { Worker } from 'bullmq';
import { connectDb, disconnectDb } from './config/db.js';
import { getRedis } from './config/redis.js';
import { TRANSACTION_QUEUE } from './modules/transactions/transactions.queue.js';
import { evaluateTransaction } from './modules/transactions/monitoring.service.js';

async function main() {
  await connectDb();

  const worker = new Worker(
    TRANSACTION_QUEUE,
    async (job) => evaluateTransaction(job.data.transactionId),
    { connection: getRedis(), concurrency: Number(process.env.WORKER_CONCURRENCY || 8) }
  );

  worker.on('completed', (job, created) => {
    if (created) console.log(`transaction ${job.data.transactionId} raised ${created} alert(s)`);
  });
  worker.on('failed', (job, err) => {
    console.error(`transaction ${job?.data?.transactionId} failed on attempt ${job?.attemptsMade}: ${err.message}`);
  });

  const shutdown = async () => {
    await worker.close();
    await disconnectDb();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  console.log('monitoring worker started');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
