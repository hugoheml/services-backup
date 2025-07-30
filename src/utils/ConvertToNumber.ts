export const ConvertToNumber = (value: any, defaultValue: number): number => {
	if (typeof value === "number") {
		return value;
	}

	const parsedValue = parseInt(value);
	return isNaN(parsedValue) ? defaultValue : parsedValue;
}