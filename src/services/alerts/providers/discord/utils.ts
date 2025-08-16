import { AlertLevel } from "../../types/AlertLevel";

const alertLevelColors: Record<AlertLevel, string> = {
	[AlertLevel.INFO]: "#00FF00",
	[AlertLevel.WARNING]: "#FFFF00",
	[AlertLevel.ERROR]: "#FF0000"
};

export function GetLevelColor(level: AlertLevel): number {
	const color = alertLevelColors[level];

	// Convert to decimal format for Discord
	return parseInt(color.replace("#", "0x"), 16);
}