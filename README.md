# Services Backup

![Work in Progress](https://img.shields.io/badge/status-WIP-orange.svg)

This project is currently a work in progress. Contributions are welcome! Feel free to open a Pull Request.

## About

Services Backup is a tool designed to automate the backup of various services. Currently, it supports the following sources:

- [**Pterodactyl**](https://pterodactyl.io/): A game server management panel.
- [**MySQL/MariaDB**](https://mysql.com/): Popular relational database management systems.
- [**PostgreSQL**](https://www.postgresql.org/): A powerful open-source relational database.
- [**Rsync**](https://en.wikipedia.org/wiki/Rsync): Mirror remote folders over SSH using rsync.
- **Local Files**: Backup local files and folders with support for exclusion patterns.

And the following storage classes:

- **Local Storage**: Store backups directly on the local filesystem.
- [**FTP**](https://en.wikipedia.org/wiki/File_Transfer_Protocol): A standard network protocol used to transfer files from one host to another over a TCP-based network.
- [**SFTP**](https://en.wikipedia.org/wiki/SSH_File_Transfer_Protocol): SSH File Transfer Protocol, a secure file transfer protocol that runs over SSH, supporting password and SSH key authentication.

The application also supports alert notifications through:

- [**Discord**](https://discord.com/): Real-time notifications via Discord webhooks for backup status and errors.

## Deployment

To deploy the application, you can use the provided `docker-compose.yaml`. The entire deployment can be done directly from the docker-compose file.

1.  Copy the content of the [`docker-compose.yaml`](docker-compose.yaml) file.
2.  Modify the environment variables directly in the file to match your configuration.
3.  Run the application using the following command:

```bash
docker-compose up -d --build
```

## Development

To set up a local development environment, you can use the development docker-compose file which includes local FTP and MySQL servers for testing. The entire development environment can be deployed directly from the docker-compose:

1.  Create a `.env` file based on [`.env.example`](.env.example) and fill in your configuration. For the local development environment, the default values should work.
2.  Start the entire development environment (including local FTP, MySQL, and PostgreSQL servers):
    ```bash
    docker-compose -f docker-compose-dev.yaml up -d --build
    ```

This will start:
- A local FTP server for testing storage functionality
- A local MySQL server with sample databases for testing backup functionality
- A local PostgreSQL server with sample databases for testing backup functionality
- A local rsync target exposed over SSH for testing rsync-based backups
- The application in development mode with hot-reloading

Alternatively, if you prefer to run the application locally while using containerized services:

1.  Start only the local services:
    ```bash
  docker-compose -f docker-compose-dev.yaml up -d --build ftp mysql postgres
    ```
2.  Install the project dependencies:
    ```bash
    npm install
    ```
3.  Run the application in development mode:
    ```bash
    npm run dev
    ```

## Requirements

For MySQL/MariaDB and PostgreSQL backup functionality in non-Docker deployments, the system requires:
- `mysqldump` utility (usually included with MySQL/MariaDB client packages)
- `pg_dump` utility (usually included with PostgreSQL client packages)
- `rsync` utility available in the runtime environment for rsync-based backups.

*Note: Docker deployments already include this dependency in the container.*

## Configuration

Here is the list of environment variables you can configure:

### General Settings

| Variable                            | Description                                                                                                             | Default   |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | --------- |
| `LOG_LEVEL`                         | Log level (error, warn, info, http, verbose, debug, silly).                                                             | `info`    |
| `TMP_DIR`                           | Temporary directory to store backups before uploading.                                                                  | `/tmp`    |
| `MAX_BACKUP_PER_ELEMENT`            | Maximum number of backups to keep per server/database.                                                                  | `5`       |
| `MAX_BACKUP_RETENTION_DAYS`         | Maximum retention duration in days for backups.                                                                         | `30`      |
| `PERIODIC_BACKUP_RETENTION_ENABLED` | Enable periodic backup retention to keep specific backups at defined intervals (`true` or `false`).                     | `false`   |
| `PERIODIC_BACKUP_RETENTION`         | Comma-separated list of time intervals (in minutes) and amounts to keep. Format: `interval1:amount1,interval2:amount2`. | _(empty)_ |

#### Periodic Backup Retention Examples

The `PERIODIC_BACKUP_RETENTION` setting allows you to define custom retention policies to keep specific backups at defined time intervals, even if they exceed the normal retention limits.

**Format:** `interval_in_minutes:amount_to_keep`

**Examples:**

- **Keep 1 backup every hour for the last 4 hours:**
  ```
  PERIODIC_BACKUP_RETENTION=60:4
  ```

- **Keep 1 backup every day for the last 7 days:**
  ```
  PERIODIC_BACKUP_RETENTION=1440:7
  ```

- **Keep 1 backup every week for the last 4 weeks:**
  ```
  PERIODIC_BACKUP_RETENTION=10080:4
  ```

- **Complex retention policy (hourly, daily, weekly, monthly):**
  ```
  PERIODIC_BACKUP_RETENTION=60:24,1440:7,10080:4,43800:3
  ```
  This example keeps:
  - 24 backups: one for each of the last 24 hour periods
  - 7 backups: one for each of the last 7 day periods
  - 4 backups: one for each of the last 4 week periods
  - 3 backups: one for each of the last 3 month periods

- **Long-term archival policy:**
  ```
  PERIODIC_BACKUP_RETENTION=525600:2,262800:4,43800:6,10080:8,1440:14
  ```
  This example keeps:
  - 2 backups: one for each of the last 2 year periods
  - 4 backups: one for each of the last 4 six-month periods
  - 6 backups: one for each of the last 6 month periods
  - 8 backups: one for each of the last 8 week periods
  - 14 backups: one for each of the last 14 day periods

**Note:** When `PERIODIC_BACKUP_RETENTION_ENABLED=true`, backups that match these retention criteria will be preserved even if they exceed the `MAX_BACKUP_PER_ELEMENT` or `MAX_BACKUP_RETENTION_DAYS` limits. The system will keep the most recent backup within each time period defined.

### Pterodactyl Settings

| Variable                     | Description                                                   | Default                     |
| ---------------------------- | ------------------------------------------------------------- | --------------------------- |
| `BACKUP_PTERODACTYL`         | Enable backup for Pterodactyl (`true` or `false`).            | `true`                      |
| `PTERODACTYL_URL`            | The URL of your Pterodactyl panel.                            | `https://panel.example.com` |
| `PTERODACTYL_API_KEY`        | Your Pterodactyl client API key.                              | `ptlc_XXXXXX`               |
| `PTERODACTYL_FETCH_AS_ADMIN` | Fetch servers as an administrator (`true` or `false`).        | `true`                      |
| `PTERODACTYL_FOLDER_PATH`    | Base path to store Pterodactyl backups on the remote storage. | `pterodactyl/servers`       |

### MySQL/MariaDB Settings

| Variable                 | Description                                                | Default                                           |
| ------------------------ | ---------------------------------------------------------- | ------------------------------------------------- |
| `BACKUP_MYSQL`           | Enable backup for MySQL/MariaDB (`true` or `false`).       | `true`                                            |
| `MYSQL_HOST`             | Your MySQL/MariaDB server host.                            | `localhost`                                       |
| `MYSQL_PORT`             | Your MySQL/MariaDB server port.                            | `3306`                                            |
| `MYSQL_USER`             | The username for the MySQL/MariaDB connection.             | `myuser`                                          |
| `MYSQL_PASSWORD`         | The password for the MySQL/MariaDB connection.             | `mypassword`                                      |
| `MYSQL_POOL_SIZE`        | Connection pool size for MySQL/MariaDB.                    | `5`                                               |
| `MYSQL_IGNORE_DATABASES` | Comma-separated list of databases to ignore during backup. | `information_schema,performance_schema,mysql,sys` |
| `MYSQL_FOLDER_PATH`      | Base path to store MySQL backups on the remote storage.    | `mysql`                                           |
| `MYSQL_SSL_ENABLED`      | Enable SSL for MySQL connection (`true` or `false`).       | `false`                                           |

### PostgreSQL Settings

| Variable                           | Description                                                   | Default               |
| ---------------------------------- | ------------------------------------------------------------- | --------------------- |
| `BACKUP_POSTGRESQL`                | Enable backup for PostgreSQL (`true` or `false`).             | `false`               |
| `POSTGRES_HOST`                    | Your PostgreSQL server host.                                  | `localhost`           |
| `POSTGRES_PORT`                    | Your PostgreSQL server port.                                  | `5432`                |
| `POSTGRES_USER`                    | The username for the PostgreSQL connection.                   | `myuser`              |
| `POSTGRES_PASSWORD`                | The password for the PostgreSQL connection.                   | `mypassword`          |
| `POSTGRES_DB`                      | Default database used for the initial connection.             | `postgres`            |
| `POSTGRES_IGNORE_DATABASES`        | Comma-separated list of databases to ignore during backup.    | `template0,template1` |
| `POSTGRES_FOLDER_PATH`             | Base path to store PostgreSQL backups on the remote storage.  | `postgresql`          |
| `POSTGRES_SSL_ENABLED`             | Enable SSL for PostgreSQL connection (`true` or `false`).     | `false`               |
| `POSTGRES_SSL_REJECT_UNAUTHORIZED` | Reject self-signed certificates when SSL is enabled (`true`). | `true`                |

### Rsync Settings

| Variable             | Description                                                                                                      | Default         |
| -------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------- |
| `BACKUP_RSYNC`       | Enable rsync-based backups (`true` or `false`).                                                                  | `false`         |
| `RSYNC_FOLDER_PATH`  | Base path to store rsync archives on the remote storage.                                                         | `rsync`         |
| `RSYNC_TARGET_NAME`  | Friendly name for the rsync target (defaults to host when empty).                                                | `remote-server` |
| `RSYNC_TARGET_HOST`  | Remote host to sync from. Supports IPv4 and IPv6.                                                                | _(empty)_       |
| `RSYNC_TARGET_USER`  | SSH user for the remote host.                                                                                    | _(empty)_       |
| `RSYNC_TARGET_PORT`  | SSH port for the remote host.                                                                                    | `22`            |
| `RSYNC_TARGET_PATH`  | Remote directory to mirror.                                                                                      | _(empty)_       |
| `RSYNC_SSH_KEY_PATH` | Optional path to the private SSH key used by rsync.                                                              | _(empty)_       |
| `RSYNC_EXCLUDES`     | Comma-separated list of patterns ignored during sync (e.g. `node_modules,tmp`).                                  | _(empty)_       |
| `RSYNC_SSH_OPTIONS`  | Additional SSH options appended to the rsync SSH command. Useful for disabling host key checks during testing.   | _(empty)_       |
| `RSYNC_EXTRA_ARGS`   | Additional rsync arguments (space separated, double quotes supported for paths or arguments that contain spaces) | _(empty)_       |

The default development `.env` values point `RSYNC_TARGET_HOST` to this container (`rsync`) and mount the generated SSH private key at `/app/docker_keys/id_ed25519`. The files served over rsync live in `docker/rsync/data`.

To generate the development key pair, run the helper script and recreate the container:

```bash
bash docker/rsync/generate-keys.sh
docker compose -f docker-compose-dev.yaml build rsync
docker compose -f docker-compose-dev.yaml up -d rsync
```

### Local Files Settings

| Variable                  | Description                                                                           | Default                    |
| ------------------------- | ------------------------------------------------------------------------------------- | -------------------------- |
| `BACKUP_LOCAL_FILES`      | Enable backup for local files and folders (`true` or `false`).                        | `false`                    |
| `LOCAL_FILES_PATH`        | Absolute path to the file or folder to backup.                                        | _(empty)_                  |
| `LOCAL_FILES_IGNORE`      | Comma-separated list of patterns to exclude from the archive (e.g., `*.log,cache/*`). | _(empty)_                  |
| `LOCAL_FILES_FOLDER_PATH` | Base path to store local files backups on the remote storage.                         | `local-files`              |
| `LOCAL_FILES_TMP_DIR`     | Temporary directory to create archives before uploading.                              | `/tmp/local-files-backups` |

#### Local Files Configuration Examples

The local files backup service allows you to backup a single file or directory with optional exclusion patterns.

**Example 1: Backup a single folder**
```bash
BACKUP_LOCAL_FILES=true
LOCAL_FILES_PATH=/etc/myapp
```

**Example 2: Backup with exclusions**
```bash
BACKUP_LOCAL_FILES=true
LOCAL_FILES_PATH=/home/user/Documents
LOCAL_FILES_IGNORE=*.log,*.tmp,cache/*,node_modules
```

**Example 3: Docker configuration**
```yaml
services:
  services-backup:
    environment:
      - BACKUP_LOCAL_FILES=true
      - LOCAL_FILES_PATH=/data
      - LOCAL_FILES_IGNORE=*.log,temp/*
    volumes:
      - /path/to/backup:/data:ro
```

### Storage Settings

| Variable                | Description                                                  | Default      |
| ----------------------- | ------------------------------------------------------------ | ------------ |
| `STORAGE_TYPE`          | The storage type to use. Supported: `ftp`, `sftp`, `local`.  | `local`      |
| `LOCAL_STORAGE_PATH`    | Path to store backups when using local storage.              | `backups`    |
| `FTP_HOST`              | Your FTP server host.                                        | `localhost`  |
| `FTP_PORT`              | Your FTP server port.                                        | `21`         |
| `FTP_USER`              | The username for the FTP connection.                         | `myuser`     |
| `FTP_PASSWORD`          | The password for the FTP connection.                         | `mypassword` |
| `SFTP_HOST`             | Your SFTP server host.                                       | `localhost`  |
| `SFTP_PORT`             | Your SFTP server port.                                       | `22`         |
| `SFTP_USER`             | The username for the SFTP connection.                        | `myuser`     |
| `SFTP_PASSWORD`         | The password for the SFTP connection (if not using SSH key). | _(empty)_    |
| `SFTP_PRIVATE_KEY_PATH` | Path to the SSH private key file for SFTP authentication.    | _(empty)_    |
| `SFTP_PASSPHRASE`       | Optional passphrase for the SSH private key.                 | _(empty)_    |

#### Using Local Storage
You must also set `LOCAL_STORAGE_PATH` to the directory where backups will be stored.
When using Docker, mount a volume to persist your backups:

```yaml
services:
  services-backup:
    ...
    environment:
      - STORAGE_TYPE=local
      - LOCAL_STORAGE_PATH=/backups
    volumes:
      - ./backups:/backups
```
Backups will be saved in the `./backups` directory on the host machine.

#### Using FTP Storage
You must set the FTP connection details:

```yaml
services:
  services-backup:
    ...
    environment:
      - STORAGE_TYPE=ftp
      - FTP_HOST=ftp.example.com
      - FTP_PORT=21
      - FTP_USER=myuser
      - FTP_PASSWORD=mypassword
```

#### Using SFTP Storage

SFTP storage supports two authentication methods:

**1. Password authentication:**

```yaml
services:
  services-backup:
    ...
    environment:
      - STORAGE_TYPE=sftp
      - SFTP_HOST=sftp.example.com
      - SFTP_PORT=22
      - SFTP_USER=myuser
      - SFTP_PASSWORD=mypassword
```

**2. SSH Key authentication (recommended):**

```yaml
services:
  services-backup:
    ...
    environment:
      - STORAGE_TYPE=sftp
      - SFTP_HOST=sftp.example.com
      - SFTP_PORT=22
      - SFTP_USER=myuser
      - SFTP_PRIVATE_KEY_PATH=/app/ssh/id_rsa
      - SFTP_PASSPHRASE=optional_key_passphrase  # Only if your key is encrypted
    volumes:
      - ./ssh-keys:/app/ssh:ro
```

**Note:** SSH key authentication is preferred over password authentication for better security. The SSH key file should be mounted as read-only (`:ro`) and have appropriate permissions (600).

### Alert Settings

| Variable                          | Description                                                      | Default   |
| --------------------------------- | ---------------------------------------------------------------- | --------- |
| `ALERT_SERVICE_ENABLED`           | Enable alert notifications (`true` or `false`).                  | `false`   |
| `ALERT_AFTER_PROCESS`             | Send alerts after each backup process (`true` or `false`).       | `false`   |
| `ALERT_DISCORD_ENABLED`           | Enable Discord alerts (`true` or `false`).                       | `false`   |
| `DISCORD_ALERT_WEBHOOK_URL`       | Discord webhook URL for sending alert notifications.             | _(empty)_ |
| `DISCORD_ALERT_EVERYONE_ON_ERROR` | Mention everyone in Discord on error alerts (`true` or `false`). | `false`   |

### Encryption Settings

| Variable                     | Description                                                 | Default           |
| ---------------------------- | ----------------------------------------------------------- | ----------------- |
| `ENCRYPTION_ENABLED`         | Enable GPG encryption for backup files (`true` or `false`). | `false`           |
| `ENCRYPTION_PUBLIC_KEY_PATH` | Path to the GPG public key file for encrypting backups.     | `/app/public.asc` |

## Encryption

Services Backup supports GPG encryption for all backup files. When enabled, all backup files are automatically encrypted using GPG before being stored.

### Generating GPG Keys

To use encryption, you need to generate a GPG key pair. Here are the commands to create, export, and manage your GPG keys:

#### 1. Generate a new GPG key pair

```bash
# Generate a new key pair interactively
gpg --full-generate-key

# Or use batch mode for automation
gpg --batch --generate-key <<EOF
%echo Generating GPG key for Services Backup
Key-Type: RSA
Key-Length: 4096
Subkey-Type: RSA
Subkey-Length: 4096
Name-Real: Services Backups
Name-Comment: Backups
Name-Email: backup@test.com
Expire-Date: 0
Passphrase: your_secure_passphrase_here
%commit
%echo Done
EOF
```

#### 2. List your keys

```bash
# List all keys
gpg --list-keys

# List secret keys
gpg --list-secret-keys
```

#### 3. Export the public key

Export public key (replace with your key ID or email)
```bash
gpg --armor --export backup@test.com > public.asc
```

#### 4. Export the private key

Export private key (replace with your key ID or email)
```bash
gpg --armor --export-secret-keys backup@test.com > private.asc
```

### Docker Configuration

When using Docker, you need to mount the GPG key files and configure the environment variables:

```yaml
services:
  services-backup:
    image: ghcr.io/hugoheml/services-backup:latest
    environment:
      # Encryption settings
      - ENCRYPTION_ENABLED=true
      - ENCRYPTION_PUBLIC_KEY_PATH=/app/keys/public.asc
      
      # Other environment variables...
      - STORAGE_TYPE=local
      - LOCAL_STORAGE_PATH=/backups
      
    volumes:
      # Mount your GPG keys
      - ./keys:/app/keys:ro
      # Mount backup storage
      - ./backups:/backups
```

**Directory structure:**
```
.
├── docker-compose.yaml
├── keys/
│   ├── public.asc    # Your GPG public key
│   └── private.asc   # Your GPG private key
└── backups/          # Backup storage directory
```

**Note:** The `keys` directory is mounted as read-only (`:ro`) for security. Make sure the key files have appropriate permissions (readable by the container user).

### Decrypting Backups

To decrypt your backup files, you can use the following methods:

#### Method 1: Using GPG command line

Decrypt a single backup file
```bash
gpg --decrypt backup-file.gz.asc > backup-file.gz
```

Decrypt with specific private key
```bash
gpg --decrypt --secret-keyring ./private.asc backup-file.gz.asc > backup-file.gz
```

For batch decryption with passphrase
```bash
echo "your_passphrase" | gpg --batch --yes --passphrase-fd 0 --decrypt backup-file.gz.asc > backup-file.gz
```

Warn: This method expose your passphrase in your `bash` history.

## Roadmap

Here are the features planned for future releases:

- [ ] Add more detailed error messages, especially for misconfigured environment variables.
- [ ] Add a maximum storage threshold to avoid filling up the storage space.
- [ ] Add more alert systems for backup failures.
- [ ] Add support for more services and storage classes.
- [ ] Make some tutorials for backuping some services
- [ ] Rework the files organization (especially in `services/` folder).
