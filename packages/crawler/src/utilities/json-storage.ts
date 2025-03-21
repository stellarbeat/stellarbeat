import * as fs from 'fs';
import { Node } from 'shared';

export default {
	readFilePromise: function (path: string): Promise<unknown> {
		return new Promise((resolve, reject) =>
			fs.readFile(path, 'utf8', function callback(err, data) {
				if (err) {
					reject(err);
				} else {
					resolve(data);
				}
			})
		);
	},

	writeFilePromise: function (
		fileName: string,
		data: string
	): Promise<unknown> {
		return new Promise((resolve, reject) =>
			fs.writeFile(fileName, data, 'utf8', function callback(err) {
				if (err) {
					reject(err);
				} else {
					resolve({});
				}
			})
		);
	},

	getNodesFromFile: async function (fileName: string): Promise<Node[]> {
		const nodesJson = (await this.readFilePromise(fileName)) as string;
		const nodesRaw = JSON.parse(nodesJson);

		return nodesRaw.map((node: Record<string, unknown>) => {
			//@ts-ignore
			return Node.fromNodeV1DTO(node);
		});
	}
};
