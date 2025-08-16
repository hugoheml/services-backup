import "dotenv/config";
import { AlertService } from "../../AlertService";
import { Alert } from "../../types/Alert";
import { AlertLevel } from "../../types/AlertLevel";
import { GetLevelColor } from "./utils";
import { logger } from "../../../log";

const { DISCORD_ALERT_WEBHOOK_URL } = process.env;

export class DiscordAlertService extends AlertService {
	
	async init() {
		if (!DISCORD_ALERT_WEBHOOK_URL) {
			throw new Error("Missing DISCORD_ALERT_WEBHOOK_URL environment variable");
		}
	}
	
	async sendAlert(alert: Alert) {
		const response = await fetch(DISCORD_ALERT_WEBHOOK_URL, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				embeds: [
					{
						title: "Alert",
						description: alert.message,
						fields: alert.fields?.map(field => ({
							name: field.name,
							value: String(field.value),
							inline: true,
						})) || [],
						color: GetLevelColor(alert.level)
					},
				],
			}),
		})

		if (!(response.status >= 200 && response.status < 300)) {
			const data = await response.json();

			logger.error(`Failed to send Discord alert: ${alert.message}`);
			logger.error(`Status: ${response.status}`);
			logger.error(`Response: ${JSON.stringify(data)}`);
		}
	}
}