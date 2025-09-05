import { BackupResult } from "./BackupResult";
import { ServerResult } from "./ServerResult";

export type ServerWithBackup = {
	server: ServerResult;
	backups: BackupResult[];
}