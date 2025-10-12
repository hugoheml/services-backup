#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
KEY_NAME="id_ed25519"
KEY_PATH="${SCRIPT_DIR}/${KEY_NAME}"
PUB_PATH="${KEY_PATH}.pub"
AUTHORIZED_KEYS_PATH="${SCRIPT_DIR}/authorized_keys"

echo "Generating development SSH key pair for the rsync test container..."

rm -f "${KEY_PATH}" "${PUB_PATH}" "${AUTHORIZED_KEYS_PATH}"

ssh-keygen -t ed25519 -N "" -C "services-backup-dev-rsync" -f "${KEY_PATH}"

cp "${PUB_PATH}" "${AUTHORIZED_KEYS_PATH}"
chmod 600 "${AUTHORIZED_KEYS_PATH}"

echo "Key pair generated:"
echo "  Private key: ${KEY_PATH}"
echo "  Public key:  ${PUB_PATH}"
echo "  Authorized:  ${AUTHORIZED_KEYS_PATH}"
echo
echo "Remember to rebuild the rsync container if it is already running:"
echo "  docker compose -f docker-compose-dev.yaml build rsync"
echo "  docker compose -f docker-compose-dev.yaml up -d rsync"
