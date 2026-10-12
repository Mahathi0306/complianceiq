import 'dotenv/config';

export const env = {
  port: Number(process.env.PORT || 4000),
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/complianceiq',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  jwtSecret: process.env.JWT_SECRET || 'dev-access-secret',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret',
  accessTtl: process.env.ACCESS_TTL || '15m',
  refreshTtl: process.env.REFRESH_TTL || '7d',
  aiServiceUrl: process.env.AI_SERVICE_URL || 'http://localhost:8000',
  aiTimeoutMs: Number(process.env.AI_TIMEOUT_MS || 20000),
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  uploadDir: process.env.UPLOAD_DIR || 'uploads',
};
