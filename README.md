# deploy

no cluster de dev

```bash
docker build -t registry.gitlab.com/voltbras/backend/api/benchmarks:v1.0.2 .
docker push registry.gitlab.com/voltbras/backend/api/benchmarks:v1.0.2
# alterar no deployment.yml
kubectl -n api-20888520-dev apply -f deployment.yml
```

```bash
yarn
docker-compose up -d
yarn prisma migrate dev
yarn start
```