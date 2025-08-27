import { FileResult } from "./FileResult";

export type FileResultWithRetention = FileResult & {
	canBeDeleted: boolean;
	additionalForTimes: number[];
}