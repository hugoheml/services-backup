export type BackupResult = {
	object: "backup",
	attributes: {
		uuid: string,
		name: string,
		ignored_files: string[],
		sha256_hash: string,
		bytes: number,
		created_at: string,
		completed_at: string,
		is_successful: boolean,
		is_locked: boolean
	}
}