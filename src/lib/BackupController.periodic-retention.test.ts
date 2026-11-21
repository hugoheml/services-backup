import assert from "node:assert/strict";
import { mkdtemp, mkdir, readdir, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { AlertManager } from "../services/alerts/AlertManager";
import { RsyncBackupService } from "../services/backup/rsync/RsyncBackupService";

test("periodic retention preserves the newest eligible archives in any storage order", async (context) => {
	const storagePath = await mkdtemp(join(tmpdir(), "periodic-retention-"));
	context.after(() => rm(storagePath, { recursive: true, force: true }));
	const settings = {
		LOCAL_STORAGE_PATH: storagePath,
		MAX_BACKUP_PER_ELEMENT: "3",
		MAX_BACKUP_RETENTION_DAYS: "30",
		PERIODIC_BACKUP_RETENTION_ENABLED: "true",
		PERIODIC_BACKUP_RETENTION: "10080:2",
	};
	for (const [key, value] of Object.entries(settings)) {
		const previous = process.env[key];
		process.env[key] = value;
		context.after(() => {
			if (previous === undefined) {
				delete process.env[key];
			} else {
				process.env[key] = previous;
			}
		});
	}

	const { BackupController } = await import("./BackupController");
	const { LocalStorage } = await import("../services/storage/local/main");
	const service = new RsyncBackupService();
	const dayMs = 24 * 60 * 60 * 1000;
	const today = Math.floor(Date.now() / dayMs) * dayMs;
	const cases = [
		{ name: "two backups within a week", ages: [41, 40], survivors: [40] },
		{ name: "oldest first", ages: [48, 47, 41, 40], survivors: [40, 47] },
		{ name: "newest first", ages: [40, 41, 47, 48], survivors: [40, 47] },
		{ name: "count limit", ages: [8, 1, 5, 3, 0, 4, 2], survivors: [0, 1, 2, 3, 8] },
	];

	for (const { name, ages, survivors } of cases) {
		await context.test(name, async (scenario) => {
			const folderPath = join(service.FOLDER_PATH, "target", name);
			const archiveName = (age: number): string => `backup-${age}.tar.gz`;
			const folder = join(storagePath, folderPath);
			await mkdir(folder, { recursive: true });
			scenario.after(() => rm(folder, { recursive: true, force: true }));
			for (const age of ages) {
				const archive = join(folder, archiveName(age));
				const date = new Date(today - age * dayMs);
				await writeFile(archive, "backup");
				await utimes(archive, date, date);
			}

			const storage = new LocalStorage();
			const listFiles = storage.listFiles.bind(storage);
			scenario.mock.method(storage, "listFiles", async (path: string) => {
				const entries = await listFiles(path);
				if (path !== folderPath) {
					return entries;
				}

				const order = ages.map(age => join(folderPath, archiveName(age)));
				return entries.sort((a, b) => order.indexOf(a.filePath) - order.indexOf(b.filePath));
			});

			const controller = new BackupController(service, storage, new AlertManager());
			await controller.doRestrictionsCheck();

			assert.deepEqual((await readdir(folder)).sort(), survivors.map(archiveName));
		});
	}
});
