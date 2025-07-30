# Services Backup

![Work in Progress](https://img.shields.io/badge/status-WIP-orange.svg)

This project is currently a work in progress. Contributions are welcome! Feel free to open a Pull Request.

## About

Services Backup is a tool designed to automate the backup of various services. Currently, it supports the following sources:

- [**Pterodactyl**](https://pterodactyl.io/): A game server management panel.

And the following storage classes:

- [**FTP**](https://en.wikipedia.org/wiki/File_Transfer_Protocol): A standard network protocol used to transfer files from one host to another over a TCP-based network.

## Deployment

To deploy the application, you can use the provided `docker-compose.yaml`.

1.  Copy the content of the [`docker-compose.yaml`](docker-compose.yaml) file.
2.  Modify the environment variables directly in the file to match your configuration.
3.  Run the application using the following command:

```bash
docker-compose up -d
```

## Development

To set up a local development environment:

1.  Start a local FTP server for testing using the development docker-compose file:
    ```bash
    docker-compose -f docker-compose-dev.yaml up -d
    ```
2.  Install the project dependencies:
    ```bash
    npm install
    ```
3.  Create a `.env` file based on [`.env.example`](.env.example) and fill in your configuration. For a local FTP server, the default values should work.
4.  Run the application in development mode with hot-reloading:
    ```bash
    npm run dev
    ```

## Configuration

Here is the list of environment variables you can configure:

| Variable                     | Description                                                   | Default                     |
| ---------------------------- | ------------------------------------------------------------- | --------------------------- |
| `LOG_LEVEL`                  | Log level (error, warn, info, http, verbose, debug, silly).   | `info`                      |
| `TMP_DIR`                    | Temporary directory to store backups before uploading.        | `/tmp`                      |
| `BACKUP_PTERODACTYL`         | Enable backup for Pterodactyl (`true` or `false`).            | `true`                      |
| `PTERODACTYL_URL`            | The URL of your Pterodactyl panel.                            | `https://panel.example.com` |
| `PTERODACTYL_API_KEY`        | Your Pterodactyl client API key.                              | `ptlc_XXXXXX`               |
| `PTERODACTYL_FETCH_AS_ADMIN` | Fetch servers as an administrator (`true` or `false`).        | `true`                      |
| `PTERODACTYL_FOLDER_PATH`    | Base path to store Pterodactyl backups on the remote storage. | `pterodactyl/servers`       |
| `STORAGE_TYPE`               | The storage type to use. Currently, only `ftp` is supported.  | `ftp`                       |
| `FTP_HOST`                   | Your FTP server host.                                         | `localhost`                 |
| `FTP_PORT`                   | Your FTP server port.                                         | `21`                        |
| `FTP_USER`                   | The username for the FTP connection.                          | `myuser`                    |
| `FTP_PASSWORD`               | The password for the FTP connection.                          | `mypassword`                |
| `MAX_BACKUP_PER_ELEMENT`     | Maximum number of backups to keep per server.                 | `5`                         |
| `MAX_BACKUP_RETENTION_DAYS`  | Maximum retention duration in days for backups.               | `30`                        |

## Roadmap

Here are the features planned for future releases:

- [ ] Add more detailed error messages, especially for misconfigured environment variables.
- [ ] Add a maximum storage threshold to avoid filling up the storage space.
- [ ] Add an alert system (e.g. via Discord) for backup failures.
- [ ] Add support for more services and storage classes.
