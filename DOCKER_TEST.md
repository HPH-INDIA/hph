# Docker test environment with Supabase

Keep `hph` and `hph-backend` in sibling directories. This stack builds the current local code, serves the UI with Nginx, and runs the Flask API with Gunicorn. PostgreSQL and private import storage stay on hosted Supabase. There are no database or Redis containers.

The Docker project is `hph-test`. Default addresses are http://localhost:8082 for the UI and http://localhost:8083 for the API. Both bind to loopback. The existing `hph` Compose stack and Render Dockerfiles are separate.

## Configure

Use Docker Compose 2.30 or newer (`env_file.format: raw` preserves literal dollar signs in secrets).

From `hph`:

```sh
cp .env.test.example .env.test
cp ../hph-backend/.env.test.example ../hph-backend/.env.test
chmod 600 .env.test ../hph-backend/.env.test
```

Fill `../hph-backend/.env.test` with the chosen Supabase project's database connection, URL, backend Storage secret, and application keys. Keep the values unquoted because this file uses raw environment-file parsing. Both private `.env.test` files are ignored by Git and excluded from Docker image builds. Supabase credentials are only supplied to the API container.

For a separate test project, copy its **Session pooler** connection string from Supabase's **Connect** dialog; this supports IPv4 Docker hosts. Use the exact supplied host and username, port 5432, a percent-encoded password, and `sslmode=require`. Change the URI scheme to `postgresql+psycopg2://`. [Supabase connection guide](https://supabase.com/docs/guides/database/connecting-to-postgres).

For a **new** test database, generate the three application keys once, paste them into the private backend file, and retain them across rebuilds:

```sh
python3 -c 'import secrets, base64; print("SECRET_KEY=" + secrets.token_hex(32)); print("ENCRYPTION_MASTER_KEY=" + base64.b64encode(secrets.token_bytes(32)).decode()); print("KAIRON_IDENTITY_KEY=" + secrets.token_hex(32))'
```

If reusing an existing Supabase database, preserve its existing application/encryption/identity keys. A separate Docker project or bucket does **not** isolate the database's users or chart records; use a separate Supabase test project for independent test data.

## Build and initialize

```sh
docker compose --env-file .env.test -f compose.test.yaml config --quiet
docker compose --env-file .env.test -f compose.test.yaml build
```

For a new test Supabase project, explicitly initialize its schema and private import bucket:

```sh
docker compose --env-file .env.test -f compose.test.yaml run --rm backend python -m flask --app run:app db upgrade
docker compose --env-file .env.test -f compose.test.yaml run --rm backend python -m flask --app run:app setup-import-storage
```

These commands modify the project configured in `../hph-backend/.env.test`. Container startup itself does not run migrations, seed data, reset records, or create buckets. To upgrade an existing test database, run the migration command after reviewing the pending migrations.

## Run and verify

```sh
docker compose --env-file .env.test -f compose.test.yaml up -d --wait
docker compose --env-file .env.test -f compose.test.yaml exec backend python scripts/check-test-environment.py
docker compose --env-file .env.test -f compose.test.yaml ps
docker compose --env-file .env.test -f compose.test.yaml logs -f
```

Open http://localhost:8082. The check script only reads the database, encryption key, and private bucket. Container health checks verify the HTTP processes; use the script to verify the external Supabase connection too.

The test API suppresses outgoing email, disables decrypted payload logging, runs Celery jobs eagerly, and processes imports in the web service. No Celery worker or Redis server is needed. Application actions still write to the configured Supabase project.

To stop:

```sh
docker compose --env-file .env.test -f compose.test.yaml down
```

This removes the test containers/network and leaves Supabase data intact. Do not run the backend-only test stack concurrently; it uses the same `hph-test` project and service.

## Linux server or different ports

Edit the frontend `.env.test` values. For LAN access set `TEST_BIND_ADDRESS=0.0.0.0` and `TEST_FRONTEND_ORIGIN=http://SERVER_IP:8082`. If changing `TEST_FRONTEND_PORT`, update the origin to match. The API remains bound to loopback; browser requests reach it through Nginx. For HTTPS, set `TEST_SECURE_COOKIES=true` and use the HTTPS origin. Recreate containers after changing environment values.
