const logger = {
  info: console.log,
  error: console.log,
  warn: console.log,
};
const { PrismaClient } = require('@prisma/client');
const stats = require('simple-statistics');

let resolv = null;
const keyPressPromise = new Promise((resolve, reject) => {
    resolv = resolve;
})

var stdin = process.openStdin();
console.log('Press enter to continue');
stdin.on('data', () => {
    resolv();
    console.log("Key pressed");
});

const prismaClients = new Map();

// const key = 'prisma_client_queries_duration_histogram_ms';
const key = 'prisma_client_queries_wait_histogram_ms';

// let lastSum = 0;
// let lastCount = 0;

async function getPrismaByAuthContext(ctx = { orgId: 'voltbras'} ) {
  if (!prismaClients.has(ctx.orgId)) {
    const prisma = new PrismaClient({
      // log: ['query'],
    });
    // setInterval(async () => {
    //   // console.log((await prisma.$metrics.json()).histograms);
    //   const h = (await prisma.$metrics.json()).histograms.find(k => key === k.key);
    //   console.log(h.value.sum - lastSum, h.value.count - lastCount, (h.value.sum - lastSum) / (h.value.count - lastCount), h.value.buckets);
    //   lastSum = h.value.sum;
    //   lastCount = h.value.count;
    // }, 5000);
    
    prismaClients.set(ctx.orgId, prisma);
  }
  const prisma = prismaClients.get(ctx.orgId);

  await prisma.$connect();
  
  await prisma.$executeRawUnsafe(
    `SET app.organization_id = ${ctx.orgId};`
  );

  return prisma;
}

async function measure(name, f, outerIters = 1, innerIters = 10) {
  const diffs = [];
  for (let j = 0; j < outerIters; j++) {
    await Promise.all(
      Array
        .from(Array(innerIters).keys())
        .map(async (_, i) => {
          const start = process.hrtime.bigint();
          await f();
          const end = process.hrtime.bigint();
          const diff = Number(end - start) / 1000000;
          diffs.push(diff);
        })
    );
  }

  logger.info(name, {
    min: stats.min(diffs).toFixed(2),
    max: stats.max(diffs).toFixed(2),
    mean: stats.mean(diffs).toFixed(2),
    // median: stats.median(diffs).toFixed(2),
    // mode: stats.mode(diffs).toFixed(2),
    // std_dev: stats.standardDeviation(diffs).toFixed(2),
    p95: stats.quantile(diffs, 0.95).toFixed(2),
    // p99: stats.quantile(diffs, 0.99).toFixed(2),
  });
}

async function main() {
  const prisma = await getPrismaByAuthContext({ orgId: 'voltbras' });

  await keyPressPromise;

  let parents;
  await measure('prisma.parent.findMany', async () => {
    parents = await prisma.parent.findMany({
      include: {
        children: true,
      },
    });
  })

  function getFirstChildren(n) {
    return parents
      .slice(0, n)
      .flatMap((p) => p.children.slice(0, n));
  }

  // // testing N+1
  // await measure(`prisma.child[5*5].findUnique().parent()`, () =>
  //   Promise.all(getFirstChildren(5).map(
  //     (child) => prisma.child
  //       .findUnique({ where: { id: child.id } })
  //       .parent()
  //   ))
  // );

  // await measure('prisma.parent.findMany2', async () => {
  //   parents = await prisma.parent.findMany({
  //     include: {
  //       children: true,
  //     },
  //   });
  // })


  // await measure(`prisma.child[10*10].findUnique().parent()`, () =>
  //   Promise.all(getFirstChildren(10).map(
  //     (child) => prisma.child
  //       .findUnique({ where: { id: child.id } })
  //       .parent()
  //   ))
  // );

  // await measure(`prisma.child[25*25].findUnique().parent()`, () =>
  //   Promise.all(getFirstChildren(25).map(
  //     (child) => prisma.child
  //       .findUnique({ where: { id: child.id } })
  //       .parent()
  //   ))
  // );

  // testing N+1
  await measure(`prisma.child[50*50].findUnique().parent()`, () =>
    Promise.all(getFirstChildren(50).map(
      (child) => prisma.child
        .findUnique({ where: { id: child.id } })
        .parent()
    ))
  );
}

main()
  .then(() => logger.info('done'))
  .catch((e) => {
    logger.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await Promise.all(
      [...prismaClients.values()]
        .map((prisma) => prisma.$disconnect())
    );
  });