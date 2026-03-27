import { PrismaClient, UserRole, SourceName, InventorySourceMode } from '@prisma/client';
import { DEFAULT_DEALERSHIP, DEFAULT_NORMALIZATION_RULES, DEFAULT_USERS } from '../server/config/defaults.js';
import { hashPassword } from '../server/lib/auth.js';

const prisma = new PrismaClient();

async function main() {
  const dealership = await prisma.dealership.upsert({
    where: { slug: DEFAULT_DEALERSHIP.slug },
    update: { name: DEFAULT_DEALERSHIP.name },
    create: {
      name: DEFAULT_DEALERSHIP.name,
      slug: DEFAULT_DEALERSHIP.slug,
    },
  });

  for (const user of DEFAULT_USERS) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        role: user.role === 'admin' ? UserRole.ADMIN : UserRole.PRICING_MANAGER,
        passwordHash: await hashPassword(user.password),
        dealershipId: dealership.id,
      },
      create: {
        dealershipId: dealership.id,
        name: user.name,
        email: user.email,
        role: user.role === 'admin' ? UserRole.ADMIN : UserRole.PRICING_MANAGER,
        passwordHash: await hashPassword(user.password),
      },
    });
  }

  for (const source of [
    { source: SourceName.AUTOXPRESS, mode: InventorySourceMode.SCRAPE, priority: 1 },
    { source: SourceName.AUTOXPRESS, mode: InventorySourceMode.FEED, priority: 0 },
    { source: SourceName.AUTOXPRESS, mode: InventorySourceMode.CSV, priority: 2 },
    { source: SourceName.CARZONE, mode: InventorySourceMode.SCRAPE, priority: 0 },
    { source: SourceName.CARSIRELAND, mode: InventorySourceMode.SCRAPE, priority: 0 },
    ...(process.env.DONEDEAL_ENABLED === 'true'
      ? [{ source: SourceName.DONEDEAL, mode: InventorySourceMode.SCRAPE, priority: 0 }]
      : []),
  ]) {
    await prisma.inventorySource.upsert({
      where: {
        dealershipId_source_mode: {
          dealershipId: dealership.id,
          source: source.source,
          mode: source.mode,
        },
      },
      update: {
        priority: source.priority,
      },
      create: {
        dealershipId: dealership.id,
        source: source.source,
        mode: source.mode,
        priority: source.priority,
      },
    });
  }

  for (const rule of DEFAULT_NORMALIZATION_RULES) {
    await prisma.normalizationRule.upsert({
      where: {
        dealershipId_dictionary_sourceValue: {
          dealershipId: dealership.id,
          dictionary: rule.dictionary,
          sourceValue: rule.sourceValue,
        },
      },
      update: {
        canonicalValue: rule.canonicalValue,
      },
      create: {
        dealershipId: dealership.id,
        dictionary: rule.dictionary,
        sourceValue: rule.sourceValue,
        canonicalValue: rule.canonicalValue,
      },
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
