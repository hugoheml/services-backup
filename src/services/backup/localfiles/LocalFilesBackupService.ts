import { BackupService } from "../BackupService";
import { BackupFileMetadata } from "../types/BackupFileMetadata";
import { loadLocalFilesTargets, createArchiveForTarget, LocalFilesTarget } from "./utils";
import { logger } from "../../log";

const { LOCAL_FILES_FOLDER_PATH, BACKUP_LOCAL_FILES } = process.env;

export class LocalFilesBackupService extends BackupService {
	SERVICE_NAME = "local-files";
	FOLDER_PATH = LOCAL_FILES_FOLDER_PATH || "local-files";

	private targets: LocalFilesTarget[] = [];

	async init() {
		this.targets = loadLocalFilesTargets();
		if (BACKUP_LOCAL_FILES === "true" && this.targets.length === 0) {
			logger.warn(`[local-files] No backup path configured. Set LOCAL_FILES_PATH to enable local files backups.`);
		}
	}

	async getElementsToBackup(): Promise<BackupFileMetadata[]> {
		if (this.targets.length === 0) {
			return [];
		}

		const backupMetadata: BackupFileMetadata[] = [];

		for (const target of this.targets) {
			try {
				const archive = await createArchiveForTarget(target);

				backupMetadata.push({
					parentElement: target.name,
					destinationFolder: `${this.FOLDER_PATH}/${archive.sanitizedName}`,
					fileName: archive.archiveName,
					uuid: `local-files-${archive.sanitizedName}-${archive.timestamp}`,
					size: archive.size,
					date: archive.date,
					localPath: archive.archivePath
				});

				logger.info(`[local-files] Created backup archive for target: ${target.name}`);
			} catch (error) {
				logger.error(`[local-files] Failed to create archive for target ${target.name}: ${error}`);
			}
		}

		return backupMetadata;
	}
}
