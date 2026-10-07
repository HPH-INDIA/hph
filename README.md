# HPH frontend

React frontend for HPH, with a Flask API in the sibling `hph-backend` repository.

## Deploy a Docker test environment

This stack runs the frontend and API in Docker while keeping PostgreSQL and private import Storage on **Supabase**. The frontend opens at `http://localhost:8082`; the API binds to `http://localhost:8083`.

Requirements: Git, Docker Engine/Desktop running, Docker Compose **2.30 or newer**, and credentials for the chosen Supabase project. Use a separate Supabase test project for independent test data. Python 3 is needed only to generate new application keys on the host.

### 1. Clone both repositories

Run these commands in the parent directory where you want the two checkouts:

```sh
git clone https://github.com/VinayVudatalaHPH/hph.git
git clone https://github.com/VinayVudatalaHPH/hph-backend.git
cd hph
docker compose version
```

For existing checkouts, enter `hph` with `hph-backend` beside it. Run the remaining commands from `hph`.

### 2. Configure the environment

Copy the templates once, then edit the private files:

```sh
cp .env.test.example .env.test
cp ../hph-backend/.env.test.example ../hph-backend/.env.test
chmod 600 .env.test ../hph-backend/.env.test
```

Set these values in `../hph-backend/.env.test`:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Supabase Session pooler URL, with scheme `postgresql+psycopg2://`, port `5432`, percent-encoded password, and `sslmode=require` |
| `SUPABASE_URL` | The chosen project's URL |
| `SUPABASE_STORAGE_SECRET_KEY` | That project's backend secret/service-role key |
| `SUPABASE_IMPORT_BUCKET` | Private test import bucket; defaults to `hph-test-imports` |
| `SECRET_KEY` | Stable application secret |
| `ENCRYPTION_MASTER_KEY` | Stable base64-encoded 32-byte encryption key |
| `KAIRON_IDENTITY_KEY` | Stable identity secret |

Use unquoted values in the backend file. Keep it private; Git and Docker builds exclude it. Copy the exact pooler host and username from the Supabase **Connect** dialog. See the [connection instructions](DOCKER_TEST.md#configure).

For a **new database**, generate the three application keys once and paste the output into the backend file:

```sh
python3 -c 'import secrets, base64; print("SECRET_KEY=" + secrets.token_hex(32)); print("ENCRYPTION_MASTER_KEY=" + base64.b64encode(secrets.token_bytes(32)).decode()); print("KAIRON_IDENTITY_KEY=" + secrets.token_hex(32))'
```

For an existing database, retain its existing keys. Rebuilding containers does not create a separate database or isolate records in a shared Supabase project.

For deployment on a LAN server, edit the frontend `.env.test` before starting:

```dotenv
TEST_BIND_ADDRESS=0.0.0.0
TEST_FRONTEND_PORT=8082
TEST_BACKEND_PORT=8083
TEST_FRONTEND_ORIGIN=http://YOUR_SERVER_IP:8082
TEST_SECURE_COOKIES=false
```

Replace `YOUR_SERVER_IP` and allow TCP port `8082` for the intended network. Keep the default loopback binding for local-only use. If serving through HTTPS, use the HTTPS origin and set `TEST_SECURE_COOKIES=true`.

### 3. Build

```sh
docker compose --env-file .env.test -f compose.test.yaml config --quiet
docker compose --env-file .env.test -f compose.test.yaml build
```

### 4. Initialize a new test project

Run these explicit setup commands for the Supabase test project configured above:

```sh
docker compose --env-file .env.test -f compose.test.yaml run --rm backend python -m flask --app run:app db upgrade
docker compose --env-file .env.test -f compose.test.yaml run --rm backend python -m flask --app run:app setup-import-storage
```

For an existing database, review pending migrations before applying them; bucket setup is only needed if it has not been configured. Container startup does not run either command automatically.

### 5. Start and verify

```sh
docker compose --env-file .env.test -f compose.test.yaml up -d --wait
docker compose --env-file .env.test -f compose.test.yaml exec backend python scripts/check-test-environment.py
docker compose --env-file .env.test -f compose.test.yaml ps
```

Open `http://localhost:8082` locally or `http://YOUR_SERVER_IP:8082` on your server. The verification script checks Supabase connectivity, the application encryption key, and the private bucket using reads only. HTTP health checks alone do not verify Supabase.

### Logs, updates, and shutdown

View logs (Ctrl+C exits the log viewer without stopping the containers):

```sh
docker compose --env-file .env.test -f compose.test.yaml logs -f
```

To deploy later code changes, first ensure both checkouts have no uncommitted work, then:

```sh
git pull --ff-only
git -C ../hph-backend pull --ff-only
docker compose --env-file .env.test -f compose.test.yaml build
```

If that release includes migrations, review them and run the `db upgrade` command from step 4 before restarting. Keep the existing `.env.test` files and application keys.

```sh
docker compose --env-file .env.test -f compose.test.yaml up -d --wait
docker compose --env-file .env.test -f compose.test.yaml exec backend python scripts/check-test-environment.py
```

Stop and remove the test containers and network:

```sh
docker compose --env-file .env.test -f compose.test.yaml down
```

Supabase data stays intact. The test image suppresses email, disables decrypted-payload logging, runs Celery jobs eagerly, and processes imports in the web service. No local PostgreSQL or Redis container is required.

See [test environment details](DOCKER_TEST.md), [backend-only deployment](https://github.com/VinayVudatalaHPH/hph-backend/blob/main/DOCKER_TEST.md), and [the existing Docker deployment](DOCKER.md).
