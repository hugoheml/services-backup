import { BackupService } from "../BackupService";
import { BackupFileMetadata } from "../types/BackupFileMetadata";
import { loadRsyncTarget, createArchiveForTarget, RsyncTarget, listRemoteFiles, sanitizeName, buildTimestamp } from "./utils";
import { logger } from "../../log";

const { RSYNC_FOLDER_PATH, BACKUP_RSYNC } = process.env;

type PendingBackup = {
	target: RsyncTarget;
	itemName: string;
	specificPath: string;
};

export class RsyncBackupService extends BackupService {
	SERVICE_NAME = "rsync";
	FOLDER_PATH = RSYNC_FOLDER_PATH || "rsync";

	private target: RsyncTarget | undefined;
	private pendingBackups: Map<string, PendingBackup> = new Map();

	async init() {
		this.target = loadRsyncTarget();
		if (BACKUP_RSYNC === "true" && !this.target) {
			logger.warn(`[rsync] Target not configured. Set RSYNC_TARGET_HOST and RSYNC_TARGET_PATH to enable rsync backups.`);
		}
	}

	async getElementsToBackup(): Promise<BackupFileMetadata[]> {
		if (!this.target) {
			return [];
		}

		try {
			// Check if path ends with /*
			if (this.target.path.endsWith("/*")) {
				return await this.getMultipleBackups();
			} else {
				return await this.getSingleBackup();
			}
		} catch (error) {
			logger.error(`[rsync] Failed to create archive: ${error}`);
			throw error;
		}
	}

	private async getSingleBackup(): Promise<BackupFileMetadata[]> {
		if (!this.target) {
			return [];
		}

		const archive = await createArchiveForTarget(this.target);

		return [
			{
				parentElement: this.target.name,
				destinationFolder: `${this.FOLDER_PATH}/${archive.sanitizedName}`,
				fileName: archive.archiveName,
				uuid: `rsync-${archive.sanitizedName}-${archive.timestamp}`,
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

		// Remove /* from the path to get the base directory
		const basePath = this.target.path.slice(0, -2);

		logger.info(`[rsync] Listing files in remote directory: ${basePath}`);
		const remoteFiles = await listRemoteFiles(this.target, basePath);

		if (remoteFiles.length === 0) {
			logger.warn(`[rsync] No files found in remote directory: ${basePath}`);
			return [];
		}

		logger.info(`[rsync] Found ${remoteFiles.length} items to backup individually`);

		const result: BackupFileMetadata[] = [];
		const date = new Date();
		const timestamp = buildTimestamp(date);

		for (const itemName of remoteFiles) {
			const sanitizedItemName = sanitizeName(itemName);
			const specificPath = `${basePath}/${itemName}`;
			// Use timestamp only in UUID for internal tracking, not in filename
			const uuid = `rsync-${sanitizeName(this.target.name)}-${sanitizedItemName}-${timestamp}`;

			// Store the pending backup info for later download
			this.pendingBackups.set(uuid, {
				target: this.target,
				itemName,
				specificPath
			});

			result.push({
				parentElement: `${this.target.name} - ${itemName}`,
				destinationFolder: `${this.FOLDER_PATH}/${sanitizeName(this.target.name)}/${sanitizedItemName}`,
				// No timestamp in filename: this allows BackupController to detect existing backups
				fileName: `${sanitizedItemName}.tar.gz`,
				uuid,
				size: 0, // Size will be known after archive creation
				date
			});
		}

		return result;
	}

	async downloadBackup(backupMetadata: BackupFileMetadata): Promise<string | undefined> {
		// Check if this is a pending backup (multi-file mode)
		const pendingBackup = this.pendingBackups.get(backupMetadata.uuid);

		if (pendingBackup) {
			// Create the archive now
			logger.info(`[rsync] Creating archive for item: ${pendingBackup.itemName}`);
			const archive = await createArchiveForTarget(
				pendingBackup.target,
				pendingBackup.specificPath,
				pendingBackup.itemName
			);

			// Remove from pending backups
			this.pendingBackups.delete(backupMetadata.uuid);

			return archive.archivePath;
		}

		// Default behavior for single backup mode
		return backupMetadata.localPath;
	}
}