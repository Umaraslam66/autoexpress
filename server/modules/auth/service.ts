import type { Request } from 'express';
import { users as demoUsers } from '../../../src/data/mockData.js';
import { env } from '../../config/env.js';
import { DEFAULT_USERS } from '../../config/defaults.js';
import { HttpError } from '../../lib/http.js';
import { prisma } from '../../lib/prisma.js';
import { verifyPassword } from '../../lib/auth.js';
import { toAppUser } from '../shared/mappers.js';
import { ensureSystemSeed } from '../setup/service.js';

export async function loginWithPassword(req: Request, email: string, password: string) {
  if (env.demoMode) {
    const normalizedEmail = email.toLowerCase().trim();
    const validUser = DEFAULT_USERS.find((user) => user.email === normalizedEmail && user.password === password);
    if (!validUser) {
      throw new HttpError(401, 'Invalid email or password.');
    }

    const demoUser = demoUsers.find((user) => user.email === normalizedEmail) ?? demoUsers[0];
    req.session.userId = demoUser.id;
    req.session.dealershipId = 'demo-dealership';
    return demoUser;
  }

  await ensureSystemSeed();

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
  });

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    throw new HttpError(401, 'Invalid email or password.');
  }

  req.session.userId = user.id;
  req.session.dealershipId = user.dealershipId;

  await prisma.sessionRecord.upsert({
    where: { sid: req.sessionID },
    update: {
      userId: user.id,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
      lastAccessedAt: new Date(),
    },
    create: {
      sid: req.sessionID,
      userId: user.id,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
    },
  });

  return toAppUser(user);
}

export async function logout(req: Request): Promise<void> {
  if (env.demoMode) {
    await new Promise<void>((resolve, reject) => {
      req.session.destroy((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
    return;
  }

  if (req.sessionID) {
    await prisma.sessionRecord.deleteMany({
      where: { sid: req.sessionID },
    });
  }

  await new Promise<void>((resolve, reject) => {
    req.session.destroy((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

export async function getCurrentUser(req: Request) {
  if (env.demoMode) {
    const userId = req.session.userId;
    if (!userId) {
      return null;
    }
    return demoUsers.find((user) => user.id === userId) ?? null;
  }

  const userId = req.session.userId;

  if (!userId) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    return null;
  }

  await prisma.sessionRecord.updateMany({
    where: { sid: req.sessionID },
    data: {
      lastAccessedAt: new Date(),
    },
  });

  return toAppUser(user);
}

export async function requireCurrentUser(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) {
    throw new HttpError(401, 'Authentication required.');
  }
  return user;
}
