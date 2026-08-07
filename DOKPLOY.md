# Deploying EduRank with Dokploy

Use a Dokploy **Application** connected to the `main` branch of this repository.

## Application settings

- Build type: **Dockerfile**
- Dockerfile path: `Dockerfile`
- Docker context path: `.`
- Port: `3000`
- Health check path: `/health`
- Restart policy: `On failure`

Add your HTTPS domain in Dokploy's Domains tab. Dokploy/Traefik terminates TLS;
the Node application should continue listening on its internal HTTP port.

## Environment variables

Set these in Dokploy's Environment tab, not in Git and not in `server/.env`:

```env
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
TRUST_PROXY=true
JWT_SECRET=replace-with-a-long-random-secret

# Use one of the following database configurations.
# Preferred: the MySQL service's internal connection URL.
DATABASE_URL=mysql://USER:PASSWORD@INTERNAL_HOST:INTERNAL_PORT/DATABASE

# Alternative: individual internal MySQL fields (do not set DATABASE_URL too).
# DB_HOST=INTERNAL_HOST
# DB_PORT=3306
# DB_USER=USER
# DB_PASSWORD=PASSWORD
# DB_NAME=DATABASE

# Replace with the public HTTPS URL assigned in Dokploy.
CLIENT_ORIGIN=https://app.example.com
CORS_ORIGIN=https://app.example.com
```

Use the MySQL service's **internal** host/port when both services run in Dokploy.
Do not commit credentials or expose the database's external port unless you need
temporary access from outside your Dokploy network.

## Deploy and verify

1. Create the application and set the variables above.
2. Add the domain, then deploy the `main` branch.
3. Confirm `https://app.example.com/health` responds with `{ "status": "ok" }`.
4. Confirm `https://app.example.com/health/db` also returns HTTP 200.

Dokploy can manage service-level environment variables and Dockerfile builds;
see its official documentation for the matching UI fields.
