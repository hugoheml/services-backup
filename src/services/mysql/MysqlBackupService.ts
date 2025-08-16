import "dotenv/config";
import { BackupService } from "../backup/BackupService";
import { BackupFileMetadata } from "../backup/types/BackupFileMetadata";
import { DumpDatabase, MysqlConnection } from "./utils";
import { statSync } from "node:fs";

const { MYSQL_FOLDER_PATH, MYSQL_IGNORE_DATABASES } = process.env;

const DATABASES_TO_IGNORE = (MYSQL_IGNORE_DATABASES || "").split(',');

export class MysqlBackupService extends BackupService {
	SERVICE_NAME = "mysql";
	FOLDER_PATH = MYSQL_FOLDER_PATH || "mysql";

	private mysqlConnection: MysqlConnection;

	async init() {
		this.mysqlConnection = await MysqlConnection.create();
	}

	async getElementsToBackup(): Promise<BackupFileMetadata[]> {
		const databases = await this.mysqlConnection.listDatabases();

		const result: BackupFileMetadata[] = [];

		for await (const db of databases) {
			if (DATABASES_TO_IGNORE.includes(db)) continue;

			const currentDate = new Date();
			const currentDateString = currentDate.toISOString().replace(/:/g, '-').split('.')[0].replace('T', '-');

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
		console.log("prout");
		this.mysqlConnection.close();
	}
}