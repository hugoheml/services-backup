export type ServerResult = {
	object: "server",
	attributes: {
		server_owner: boolean,
		identifier: string,
		internal_id: number,
		uuid: string,
		name: string,
		node: string
	}
}