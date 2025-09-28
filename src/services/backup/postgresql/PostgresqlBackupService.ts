import "dotenv/config";
import { statSync } from "node:fs";
import { BackupService } from "../../backup/BackupService";
import { BackupFileMetadata } from "../../backup/types/BackupFileMetadata";
import { DumpDatabase, PostgresConnection } from "./utils";

const { POSTGRES_FOLDER_PATH, POSTGRES_IGNORE_DATABASES } = process.env;

const DEFAULT_DATABASES_TO_IGNORE = ["template0", "template1"];
const ENV_DATABASES_TO_IGNORE = (POSTGRES_IGNORE_DATABASES || "")
	.split(",")
	.map((db) => db.trim())
	.filter((db) => db.length > 0);

const DATABASES_TO_IGNORE = new Set<string>([...DEFAULT_DATABASES_TO_IGNORE, ...ENV_DATABASES_TO_IGNORE]);

export class PostgresqlBackupService extends BackupService {
	SERVICE_NAME = "postgresql";
	FOLDER_PATH = POSTGRES_FOLDER_PATH || "postgresql";

	private postgresConnection: PostgresConnection;

	async init() {
		this.postgresConnection = await PostgresConnection.create();
	}

	async getElementsToBackup(): Promise<BackupFileMetadata[]> {
		const databases = await this.postgresConnection.listDatabases();

		const result: BackupFileMetadata[] = [];

		for await (const db of databases) {
			if (DATABASES_TO_IGNORE.has(db)) continue;

			const currentDate = new Date();
			const currentDateString = currentDate.toISOString().replace(/:/g, "-").split(".")[0].replace("T", "-");

			const dumpPath = await DumpDatabase(db);

			result.push({
				parentElement: db,
				destinationFolder: `${this.FOLDER_PATH}/${db}`,
				fileName: `${db}-${currentDateString}.gz`,
				uuid: `db-${db}-${currentDateString}`,
				size: statSync(dumpPath).size,
				date: currentDate,
				localPath: dumpPath
			});
		}

		return result;
	}

	async close() {
		await this.postgresConnection?.close();
	}
}
