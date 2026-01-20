import "dotenv/config";
import { FTPStorage } from "./ftp/main";
import { SFTPStorage } from "./sftp/main";
import { LocalStorage } from "./local/main";

const { STORAGE_TYPE } = process.env;

export function GetStorageClass() {
	switch (STORAGE_TYPE) {
		case "ftp": {
			return new FTPStorage();
		}

		case "sftp": {
			return new SFTPStorage();
		}

		case "local": {
			return new LocalStorage();
		}
		
		default: {
			throw new Error(`Unsupported storage type: ${STORAGE_TYPE}`);
		}
	}
}