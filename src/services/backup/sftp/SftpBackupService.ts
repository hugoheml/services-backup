import { BackupService } from "../BackupService";
import { BackupFileMetadata } from "../types/BackupFileMetadata";
import { loadSftpBackupTarget, downloadAndArchive, listRemoteItems, sanitizeName, buildTimestamp, SftpBackupTarget } from "./utils";
import { logger } from "../../log";

const { SFTP_BACKUP_FOLDER_PATH, BACKUP_SFTP } = process.env;

type PendingBackup = {
	target: SftpBackupTarget;
	itemName: string;
	remotePath: string;
};

export class SftpBackupService extends BackupService {
	SERVICE_NAME = "sftp-backup";
	FOLDER_PATH = SFTP_BACKUP_FOLDER_PATH || "sftp";

	private target: SftpBackupTarget | undefined;
	private pendingBackups: Map<string, PendingBackup> = new Map();

	async init() {
		this.target = loadSftpBackupTarget();
		if (BACKUP_SFTP === "true" && !this.target) {
			logger.warn(`[sftp-backup] Target not configured. Set SFTP_BACKUP_HOST, SFTP_BACKUP_USER, and SFTP_BACKUP_PATH to enable SFTP backups.`);
		}
	}

	async getElementsToBackup(): Promise<BackupFileMetadata[]> {
		if (!this.target) {
			return [];
		}

		try {
			if (this.target.folders && this.target.folders.length > 0) {
				return await this.getExplicitFoldersBackup();
			} else if (this.target.path.endsWith("*")) {
				return await this.getMultipleBackups();
			} else {
				return await this.getSingleBackup();
			}
		} catch (error) {
			logger.error(`[sftp-backup] Failed to prepare backups: ${error}`);
			throw error;
		}
	}

	private async getExplicitFoldersBackup(): Promise<BackupFileMetadata[]> {
		if (!this.target || !this.target.folders) {
			return [];
		}

		const basePath = this.target.path.endsWith("/*")
			? this.target.path.slice(0, -2)
			: this.target.path.endsWith("*")
				? this.target.path.slice(0, -1)
				: this.target.path;

		logger.info(`[sftp-backup] Using explicit folder list: ${this.target.folders.join(", ")}`);

		const result: BackupFileMetadata[] = [];
		const date = new Date();
		const timestamp = buildTimestamp(date);

		for (const folderName of this.target.folders) {
			const sanitizedFolderName = sanitizeName(folderName);
			const remotePath = `${basePath}/${folderName}`;
			const uuid = `sftp-${sanitizeName(this.target.name)}-${sanitizedFolderName}-${timestamp}`;

			this.pendingBackups.set(uuid, {
				target: this.target,
				itemName: folderName,
				remotePath
			});

			result.push({
				parentElement: `${this.target.name} - ${folderName}`,
				destinationFolder: `${this.FOLDER_PATH}/${sanitizeName(this.target.name)}/${sanitizedFolderName}`,
				fileName: `${sanitizedFolderName}.tar.gz`,
				uuid,
				size: 0,
				date
			});
		}

		return result;
	}

	private async getSingleBackup(): Promise<BackupFileMetadata[]> {
		if (!this.target) {
			return [];
		}

		const archive = await downloadAndArchive(this.target, this.target.path);

		return [
			{
				parentElement: this.target.name,
				destinationFolder: `${this.FOLDER_PATH}/${archive.sanitizedName}`,
				fileName: archive.archiveName,
				uuid: `sftp-${archive.sanitizedName}-${archive.timestamp}`,
				size: archive.size,
				date: archive.date,
				localPath: archive.archivePath
			}
		];
	}

	private async getMultipleBackups(): Promise<BackupFileMetadata[]> {
		if (!this.target) {
			return [];
		}

		const basePath = this.target.path.endsWith("/*")
			? this.target.path.slice(0, -2)
			: this.target.path.slice(0, -1);

		logger.info(`[sftp-backup] Listing items in remote directory: ${basePath}`);
		const remoteItems = await listRemoteItems(this.target, basePath);

		if (remoteItems.length === 0) {
			logger.warn(`[sftp-backup] No items found in remote directory: ${basePath}`);
			return [];
		}

		logger.info(`[sftp-backup] Found ${remoteItems.length} items to backup individually`);

		const result: BackupFileMetadata[] = [];
		const date = new Date();
		const timestamp = buildTimestamp(date);

		for (const itemName of remoteItems) {
			const sanitizedItemName = sanitizeName(itemName);
			const remotePath = `${basePath}/${itemName}`;
			const uuid = `sftp-${sanitizeName(this.target.name)}-${sanitizedItemName}-${timestamp}`;

			this.pendingBackups.set(uuid, {
				target: this.target,
				itemName,
				remotePath
			});

			result.push({
				parentElement: `${this.target.name} - ${itemName}`,
				destinationFolder: `${this.FOLDER_PATH}/${sanitizeName(this.target.name)}/${sanitizedItemName}`,
				fileName: `${sanitizedItemName}.tar.gz`,
				uuid,
				size: 0,
				date
			});
		}

		return result;
	}

	async downloadBackup(backupMetadata: BackupFileMetadata): Promise<string | undefined> {
		const pendingBackup = this.pendingBackups.get(backupMetadata.uuid);

		if (pendingBackup) {
			logger.info(`[sftp-backup] Downloading item: ${pendingBackup.itemName}`);
			const archive = await downloadAndArchive(
				pendingBackup.target,
				pendingBackup.remotePath,
				pendingBackup.itemName
			);

			this.pendingBackups.delete(backupMetadata.uuid);
			return archive.archivePath;
		}

		return backupMetadata.localPath;
	}
}
