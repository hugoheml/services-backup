# SFTP Storage Implementation

This directory contains the SFTP storage implementation for services-backup.

## Features

- **Dual Authentication**: Supports both password and SSH key-based authentication
- **Secure Connection**: Uses SSH protocol for encrypted file transfers
- **Full Storage API**: Implements all required methods from StorageClass
- **IPv6 Support**: Automatically converts hostnames to IP addresses
- **Recursive Operations**: Supports recursive folder creation and deletion

## Authentication Methods

### 1. Password Authentication

Set the following environment variables:

```bash
STORAGE_TYPE=sftp
SFTP_HOST=sftp.example.com
SFTP_PORT=22
SFTP_USER=myuser
SFTP_PASSWORD=mypassword
```

### 2. SSH Key Authentication (Recommended)

Set the following environment variables:

```bash
STORAGE_TYPE=sftp
SFTP_HOST=sftp.example.com
SFTP_PORT=22
SFTP_USER=myuser
SFTP_PRIVATE_KEY_PATH=/path/to/private/key
# Optional: if your key is encrypted
SFTP_PASSPHRASE=your_key_passphrase
```

## Priority

If both `SFTP_PRIVATE_KEY_PATH` and `SFTP_PASSWORD` are provided, SSH key authentication takes priority.

## Docker Example

```yaml
services:
  services-backup:
    image: ghcr.io/hugoheml/services-backup:latest
    environment:
      - STORAGE_TYPE=sftp
      - SFTP_HOST=sftp.example.com
      - SFTP_PORT=22
      - SFTP_USER=myuser
      - SFTP_PRIVATE_KEY_PATH=/app/ssh/id_rsa
    volumes:
      - ./ssh-keys:/app/ssh:ro
      - ./backups:/tmp
```

## Generating SSH Keys

```bash
# Generate a new SSH key pair
ssh-keygen -t rsa -b 4096 -f ./ssh-keys/id_rsa -C "services-backup"

# Copy the public key to your SFTP server
ssh-copy-id -i ./ssh-keys/id_rsa.pub user@sftp.example.com
```

## Implementation Details

The SFTP storage class uses the `ssh2-sftp-client` library, which provides:

- Robust error handling
- Promise-based API
- Support for all common SFTP operations
- Compatibility with most SFTP servers

## Methods

All methods are inherited from `StorageClass`:

- `init()`: Establishes the SFTP connection
- `uploadFile(filePath, destination)`: Uploads a file to the SFTP server
- `deleteFile(filePath)`: Deletes a file from the SFTP server
- `createFolder(folderPath)`: Creates a folder (recursive)
- `deleteFolder(folderPath)`: Deletes a folder and its contents
- `folderExists(folderPath)`: Checks if a folder exists
- `folderSizeBytes(folderPath)`: Calculates the total size of a folder
- `listFiles(folderPath)`: Lists all files and folders in a directory
- `close()`: Closes the SFTP connection
