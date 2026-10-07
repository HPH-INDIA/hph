# Docker Compose

Keep `hph` and `hph-backend` as sibling directories. From `hph`, run:

```sh
docker compose up --build -d
docker compose ps
docker compose logs -f
docker compose down
```

Open http://localhost:8080. The backend is also available at http://localhost:8081.
This starts both containers. Nginx forwards `/api/`, `/openapi.json`, and `/swagger-ui` to the backend container. Vite uses the same `/api` build setting as the Render Dockerfile; no frontend secrets or runtime environment file is needed.

The backend reads the existing `../hph-backend/.env.render` unchanged, including the Supabase database URL and storage credentials. Keep this private file out of Git. No local database or Redis container is started: the Render configuration runs Celery eagerly and imports in the web process.

Compose overrides the secure-cookie flag, login URL, and CORS origins for local HTTP, sets the container port to 8080, and enables embedded imports. Other Render values are preserved. To customize these settings, copy `.env.compose.example` to `.env.compose`, edit it, then run `docker compose --env-file .env.compose up --build -d`. For an HTTPS deployment, set `SESSION_COOKIE_SECURE=true` and use your public URLs.

The regular Render Nginx configuration is unchanged. Compose uses `nginx.compose.conf`.

Containers start Gunicorn directly using the existing Dockerfile. They do not automatically run migrations or change Supabase storage. If schema/storage setup is needed, run the existing Render startup setup commands deliberately against your configured database:

```sh
docker compose exec backend python -m flask --app run:app db upgrade
docker compose exec backend python -m flask --app run:app setup-import-storage
```

Do not start the backend-only Compose stack separately while this stack is running; both use the same project name and backend service.

## Local Linux server

Install Docker Engine with the Compose plugin on the server. Copy both repositories as sibling directories and securely copy the backend `.env.render` file; Git does not include it. The server needs outbound access to the existing Supabase services.

Copy `.env.compose.example` to `.env.compose` in the directory from which you run Compose. Replace `192.168.1.100` with the Linux server's LAN IP or hostname in `FRONTEND_LOGIN_URL` and `CORS_ALLOWED_ORIGINS`, then run:

```sh
docker compose --env-file .env.compose up --build -d
```

For the full stack, run this from `hph` and open `http://SERVER_IP:8080` on a client machine. The frontend listens on all server interfaces; permit TCP port 8080 in the server firewall for the intended network. The backend port 8081 binds to loopback by default, and Nginx reaches it through the Docker network. For backend-only LAN access, set `BACKEND_BIND_ADDRESS=0.0.0.0` and permit the chosen backend port.

HTTP uses `SESSION_COOKIE_SECURE=false`. If you terminate HTTPS in a reverse proxy, set it to `true` and use the HTTPS frontend URL and origin. The Supabase database and all existing backend secrets remain in `.env.render`; only server-specific settings go in `.env.compose`.

## Dedicated test environment

Use `Dockerfile.test` and `compose.test.yaml` for the separate `hph-test` stack. See [DOCKER_TEST.md](DOCKER_TEST.md) for setup. The test API reads `.env.test` and keeps PostgreSQL and Storage on Supabase.
