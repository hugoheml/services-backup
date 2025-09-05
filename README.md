# Services Backup

![Work in Progress](https://img.shields.io/badge/status-WIP-orange.svg)

This project is currently a work in progress. Contributions are welcome! Feel free to open a Pull Request.

## About

Services Backup is a tool designed to automate the backup of various services. Currently, it supports the following sources:

- [**Pterodactyl**](https://pterodactyl.io/): A game server management panel.
- [**MySQL/MariaDB**](https://mysql.com/): Popular relational database management systems.

And the following storage classes:

- **Local Storage**: Store backups directly on the local filesystem.
- [**FTP**](https://en.wikipedia.org/wiki/File_Transfer_Protocol): A standard network protocol used to transfer files from one host to another over a TCP-based network.

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
2.  Start the entire development environment (including local FTP and MySQL servers):
    ```bash
    docker-compose -f docker-compose-dev.yaml up -d --build
    ```

This will start:
- A local FTP server for testing storage functionality
- A local MySQL server with sample databases for testing backup functionality
- The application in development mode with hot-reloading

Alternatively, if you prefer to run the application locally while using containerized services:

1.  Start only the local services:
    ```bash
    docker-compose -f docker-compose-dev.yaml up -d --build ftp mysql
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

For MySQL/MariaDB backup functionality in non-Docker deployments, the system requires:
- `mysqldump` utility (usually included with MySQL/MariaDB client packages)

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

### Storage Settings

| Variable             | Description                                         | Default      |
| -------------------- | --------------------------------------------------- | ------------ |
| `STORAGE_TYPE`       | The storage type to use. Supported: `ftp`, `local`. | `local`      |
| `LOCAL_STORAGE_PATH` | Path to store backups when using local storage.     | `backups`    |
| `FTP_HOST`           | Your FTP server host.                               | `localhost`  |
| `FTP_PORT`           | Your FTP server port.                               | `21`         |
| `FTP_USER`           | The username for the FTP connection.                | `myuser`     |
| `FTP_PASSWORD`       | The password for the FTP connection.                | `mypassword` |

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

### Alert Settings

| Variable                          | Description                                                      | Default   |
| --------------------------------- | ---------------------------------------------------------------- | --------- |
| `ALERT_SERVICE_ENABLED`           | Enable alert notifications (`true` or `false`).                  | `false`   |
| `ALERT_AFTER_PROCESS`             | Send alerts after each backup process (`true` or `false`).       | `false`   |
| `ALERT_DISCORD_ENABLED`           | Enable Discord alerts (`true` or `false`).                       | `false`   |
| `DISCORD_ALERT_WEBHOOK_URL`       | Discord webhook URL for sending alert notifications.             | _(empty)_ |
| `DISCORD_ALERT_EVERYONE_ON_ERROR` | Mention everyone in Discord on error alerts (`true` or `false`). | `false`   |

## Roadmap

Here are the features planned for future releases:

- [ ] Add more detailed error messages, especially for misconfigured environment variables.
- [ ] Add a maximum storage threshold to avoid filling up the storage space.
- [ ] Add more alert systems for backup failures.
- [ ] Add support for more services and storage classes.
- [ ] Rework the files organization (especially in `services/` folder).