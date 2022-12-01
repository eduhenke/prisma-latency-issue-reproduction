const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const randInt = (max) => Math.ceil(Math.random() * max);
const range = (n) => Array.from(Array(n).keys());

async function seed() {
  console.log('seeding...');
  
  await prisma.parent.createMany({
    data: range(100).map((id) => ({
      id,
      name: `Parent #${id}`,
    })),
  });

  await prisma.child.createMany({
    data: range(10000).map((id) => ({
      parentId: id % 100,
      id
    })),
  })

  console.log('seeded!');
  await prisma.$disconnect();
}

seed().catch((e) => console.error('on seeding db', e));
