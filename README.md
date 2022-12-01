# prisma-latency-issue-reproduction


## setup

```bash
yarn
docker-compose up -d
yarn prisma migrate dev
yarn start
```

## schema

We have a `Parent` and a `Child` table, `Parent` has N `Child`.

We seed it with 100 Parents and each parent having 100 Child.

We have a connection pool with 10 connections(same number as `innerIters`)

## explanation

The `measure` auxilliary function is a HoF that you pass a function to check how much time has passed, it has two parameters: `innerIters` controls how many times parallely the function is going to be called, while `outerIters` controls how many experiments are made sequentially(a higher `outerIters` means a more statistically-significant test).

The first function being measured is:
```ts
await prisma.parent.findMany({
  include: {
    children: true,
  },
});
```

The second one uses the fact that Prisma batches queries using the dataloader, and we're testing that, we get the first N children of the first N parents(in this function N=50, but you can uncomment the other cases):

```ts
function getFirstChildren(n) {
  return parents
    .slice(0, n)
    .flatMap((p) => p.children.slice(0, n));
}

// testing N+1
await measure(`prisma.child[50*50].findUnique().parent()`, () =>
  Promise.all(getFirstChildren(50).map(
    (child) => prisma.child
      .findUnique({ where: { id: child.id } })
      .parent()
  ))
);
```

## results

We ran the experiment with the following parameters:
- sequentially, waiting the previous prisma request to be fully executed before executing the next one(outerIters=10, innerIters=1), there's also a CPU Profile with the name `sequential-outerIters-10---innerIters-1.cpuprofile`, that you can look at.
- paralelly, sending `innerIters` prisma requests at the same time, and waiting all of them to complete, we measure the time it took for each one to finalize, there's also a CPU Profile with the name `parallel-outerIters-1---innerIters-10.cpuprofile`, that you can look at.

The results for each function are:

### sequential
```
prisma.parent.findMany { min: '68.15', max: '109.93', mean: '89.16', p95: '109.93' }
prisma.child[50*50].findUnique().parent() { min: '917.62', max: '1406.94', mean: '1120.94', p95: '1406.94' }
```

### parallel
```
prisma.parent.findMany { min: '227.51', max: '294.48', mean: '265.37', p95: '294.48' }
prisma.child[50*50].findUnique().parent() { min: '5689.99', max: '8061.32', mean: '6990.23', p95: '8061.32' }
```

### why so slow?

We'd like to know the causes for the slow performance, even when running locally. This is seriously affecting our system's performance, as we're having simple Prisma queries taking +5 seconds routinely.

We thought it had to do with the connection pool taking too long to release a connection, but if you see, we have commented out a `setInterval` that was logging the Prisma histogram buckets for connection pool wait time, and it was really lower(all requests having a connection in less than 100ms). And we also have a `pool_timeout` of 1s, yet it never reaches this timeout.

We're considering dropping Prisma as this issues is affecting our system's performance, with no apparent workaround.