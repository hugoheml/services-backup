import "dotenv/config";
import { BackupService } from "../backup/BackupService";
import { BackupFileMetadata } from "../backup/types/BackupFileMetadata";
import { ServerWithBackup } from "./types/ServerWithBackup";
import { DownloadServerBackup, FetchAllServersBackups, GetBackupFileName } from "./utils";

const { PTERODACTYL_FOLDER_PATH } = process.env;

export class PterodactylBackupService extends BackupService {
	SERVICE_NAME = "Pterodactyl";
	FOLDER_PATH = PTERODACTYL_FOLDER_PATH || "/pterodactyl/backups";

	private serverBackups: ServerWithBackup[] = [];

	async getElementsToBackup() {
		const serverBackups = await FetchAllServersBackups();
		this.serverBackups = serverBackups;

		const result: BackupFileMetadata[] = [];
		for (const serverBackup of this.serverBackups) {
			for (const backup of serverBackup.backups) {
				result.push({
					parentElement: `${serverBackup.server.attributes.name} (${serverBackup.server.attributes.uuid})`,
					destinationFolder: `${this.FOLDER_PATH}/${serverBackup.server.attributes.uuid}`,
					fileName: GetBackupFileName(serverBackup.server, backup),
					uuid: backup.attributes.uuid,
					size: backup.attributes.bytes,
					date: new Date(backup.attributes.created_at)
				});
			}
		}

		return result;
	}

	async downloadBackup(backupMetadata: BackupFileMetadata) {
		const serverBackup = this.serverBackups.find(server => 
			server.backups.some(backup => backup.attributes.uuid === backupMetadata.uuid)
		);

		if (!serverBackup) {
			throw new Error(`Backup with UUID ${backupMetadata.uuid} not found.`);
		}

		const backupToRestore = serverBackup.backups.find(backup => backup.attributes.uuid === backupMetadata.uuid);
		if (!backupToRestore) {
			throw new Error(`Backup with UUID ${backupMetadata.uuid} not found in server ${serverBackup.server.attributes.name}.`);
		}

		const backupPath = await DownloadServerBackup(serverBackup.server, backupToRestore);
		if (!backupPath) {
			throw new Error(`Failed to download backup with UUID ${backupMetadata.uuid} for server ${serverBackup.server.attributes.name}.`);
		}

		return backupPath;
	}

	async getBackupTargetFolder(backupMetadata: BackupFileMetadata) {
		const serverBackup = this.serverBackups.find(server => 
			server.backups.some(backup => backup.attributes.uuid === backupMetadata.uuid)
		);

		if (!serverBackup) {
			throw new Error(`Backup with UUID ${backupMetadata.uuid} not found.`);
		}

		return `${this.FOLDER_PATH}/${serverBackup.server.attributes.uuid}`;
	}
}