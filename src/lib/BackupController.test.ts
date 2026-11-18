import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { BackupController } from "./BackupController";
import { AlertManager } from "../services/alerts/AlertManager";
import { RsyncBackupService } from "../services/backup/rsync/RsyncBackupService";

test("rsync retention prunes archives inside item folders and preserves recent backups", async (context) => {
	const storagePath = await mkdtemp(join(tmpdir(), "rsync-retention-"));
	context.after(async () => rm(storagePath, { recursive: true, force: true }));
	const originalStoragePath = process.env.LOCAL_STORAGE_PATH;
	process.env.LOCAL_STORAGE_PATH = storagePath;
	const { LocalStorage } = await import("../services/storage/local/main");
	context.after(() => {
		if (originalStoragePath === undefined) {
			delete process.env.LOCAL_STORAGE_PATH;
		} else {
			process.env.LOCAL_STORAGE_PATH = originalStoragePath;
		}
	});

	const service = new RsyncBackupService();
	const controller = new BackupController(service, new LocalStorage(), new AlertManager());
	const targetFolder = join(storagePath, service.FOLDER_PATH, "nextcloud");
	const expiredFolder = join(targetFolder, "expired");
	const currentFolder = join(targetFolder, "current");
	await mkdir(expiredFolder, { recursive: true });
	await mkdir(currentFolder);
	const expiredArchive = join(expiredFolder, "expired.tar.gz");
	const currentArchive = join(currentFolder, "current.tar.gz");
	const olderArchive = join(currentFolder, "older.tar.gz");
	const additionalArchives = [join(currentFolder, "recent-a.tar.gz"), join(currentFolder, "recent-b.tar.gz")];
	await writeFile(expiredArchive, "expired archive");
	await writeFile(currentArchive, "current archive");
	await writeFile(olderArchive, "older archive");
	for (const archive of additionalArchives) {
		await writeFile(archive, "recent archive");
	}
	const expired = new Date(2000, 0, 1);
	const older = new Date(Date.now() - 60 * 60 * 1000);
	await utimes(expiredArchive, expired, expired);
	await utimes(olderArchive, older, older);
	await utimes(expiredFolder, expired, expired);
	await utimes(currentFolder, expired, expired);

	await controller.doRestrictionsCheck();

	await assert.rejects(readFile(expiredArchive), { code: "ENOENT" });
	await assert.rejects(readFile(olderArchive), { code: "ENOENT" });
	assert.equal(await readFile(currentArchive, "utf8"), "current archive");
	for (const archive of additionalArchives) {
		assert.equal(await readFile(archive, "utf8"), "recent archive");
	}
});
