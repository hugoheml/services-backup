import { FileResult } from "./types/FileResult";

export abstract class StorageClass {
	abstract deleteFile(filePath: string): Promise<void>;
	abstract uploadFile(filePath: string, destination: string): Promise<void>;
	
	abstract createFolder(folderPath: string): Promise<void>;
	abstract deleteFolder(folderPath: string): Promise<void>;
	abstract folderExists(folderPath: string): Promise<boolean>;
	abstract folderSizeBytes(folderPath: string): Promise<number>;
	abstract listFiles(folderPath: string): Promise<FileResult[]>;

	abstract init(): Promise<void>;
	abstract close(): Promise<void>;
}