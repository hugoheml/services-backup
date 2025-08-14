import "dotenv/config";
import { GetStorageClass } from "./services/storage/main";

import { PterodactylBackupService } from "./services/pterodactyl/PterodactylBackupService";
import { BackupController } from "./lib/BackupController";

const BACKUP_PTERODACTYL = process.env.BACKUP_PTERODACTYL === "true";

async function main() {
	const storageClass = GetStorageClass();
	await storageClass.init();

	if (BACKUP_PTERODACTYL) {
		const pterodactylBackupService = new PterodactylBackupService();
		await pterodactylBackupService.init();

		const backupController = new BackupController(pterodactylBackupService, storageClass);
		await backupController.process();
	}
	
	await storageClass.close();
}
main();