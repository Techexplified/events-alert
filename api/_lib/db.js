import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis;

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
} else {
  // Also retain in serverless production to avoid connection exhaustion on warm starts
  globalForPrisma.prisma = prisma;
}

export default prisma;
