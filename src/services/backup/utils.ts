import { BackupFileMetadata } from "./types/BackupFileMetadata";

export function GetBackupsPerDestinationFolder<T extends BackupFileMetadata>(backups: T[]): Map<string, T[]> {
	const backupFolders = new Map<string, T[]>();
	for (const backup of backups) {
		if (!backupFolders.has(backup.destinationFolder)) {
			backupFolders.set(backup.destinationFolder, []);
		}
		backupFolders.get(backup.destinationFolder)?.push(backup);
	}

	return backupFolders;
}