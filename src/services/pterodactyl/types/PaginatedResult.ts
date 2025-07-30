export type PaginatedResult<T> = {
	object: "list",
	data: T[],
	meta: {
		pagination: {
			total: number,
			count: number,
			per_page: number,
			current_page: number,
			total_pages: number
		}
	}
}