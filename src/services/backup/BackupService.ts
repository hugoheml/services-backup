import { BackupFileMetadata } from "./types/BackupFileMetadata";

export abstract class BackupService {
	abstract SERVICE_NAME: string;
	abstract FOLDER_PATH: string;

	abstract init(): Promise<void>;
	abstract getElementsToBackup(): Promise<BackupFileMetadata[]>;
	downloadBackup(backupMetadata: BackupFileMetadata): Promise<string | undefined> {
		return Promise.resolve(backupMetadata.localPath);
	}
}