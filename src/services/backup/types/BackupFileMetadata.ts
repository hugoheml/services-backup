export type BackupFileMetadata = {
	destinationFolder: string;
	parentElement: string;
	fileName: string;
	localPath?: string;
	uuid: string;
	size: number;
	date: Date;
}