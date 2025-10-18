import { PrismaClient } from '@prisma/client';

// Singleton pattern - one Prisma Client instance for the entire app
// Prevents "Too many database connections" errors
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

export default prisma;
