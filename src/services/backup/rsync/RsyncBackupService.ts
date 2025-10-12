import { BackupService } from "../BackupService";
import { BackupFileMetadata } from "../types/BackupFileMetadata";
import { loadRsyncTarget, createArchiveForTarget, RsyncTarget } from "./utils";
import { logger } from "../../log";

const { RSYNC_FOLDER_PATH, BACKUP_RSYNC } = process.env;

export class RsyncBackupService extends BackupService {
	SERVICE_NAME = "rsync";
	FOLDER_PATH = RSYNC_FOLDER_PATH || "rsync";

	private target: RsyncTarget | undefined;

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
		} catch (error) {
			logger.error(`[rsync] Failed to create archive: ${error}`);
			throw error;
		}
	}
}