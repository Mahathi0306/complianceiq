import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yaml';
import { env } from './config/env.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import routes from './routes.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const openapi = YAML.parse(fs.readFileSync(path.join(here, '../docs/openapi.yaml'), 'utf8'));

fs.mkdirSync(env.uploadDir, { recursive: true });

const app = express();

app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: env.clientOrigin, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapi));
app.use('/api', apiLimiter, routes);

app.use(notFound);
app.use(errorHandler);

export default app;
