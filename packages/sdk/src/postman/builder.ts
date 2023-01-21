import { OperationType } from '@wundergraph/protobuf';
import { JSONSchema7Definition } from 'json-schema';
import { Collection, Item, PropertyList, Request } from 'postman-collection';
import { GraphQLOperation } from '../graphql/operations';

export interface PostmanBuilderOptions {
	baseURL: string;
}

export interface JSONSchemaParameterPath {
	path: string[];
	required: boolean;
	type: string;
}

type BuildItemReturn = { isMutation: boolean; item: any };

const buildItem = (op: GraphQLOperation, operationURL: string, opName: string) => {
	let paths: JSONSchemaParameterPath[] = [];
	buildPath([], false, op.VariablesSchema, paths);

	const returnValue: BuildItemReturn = { isMutation: false, item: {} };

	if (op.OperationType !== OperationType.MUTATION) {
		const request = queryRequestJson(operationURL, paths);

		returnValue.isMutation = false;
		returnValue.item = {
			id: op.Name,
			name: opName,
			request: request,
		};
	} else if (op.OperationType === OperationType.MUTATION) {
		const request = mutationRequestJson(operationURL, paths);

		returnValue.isMutation = true;
		returnValue.item = {
			id: op.Name,
			name: opName,
			request: request,
		};
	}
	return returnValue;
};

type AddToFolderInput = {
	item: BuildItemReturn;
	folder: string;
	mutationGroup: Collection;
	queryGroup: Collection;
};

const addItemToFolder = ({ item, folder, mutationGroup, queryGroup }: AddToFolderInput) => {
	if (item.isMutation) {
		const folderName = `${folder}Mutations`;
		if (mutationGroup.items.one(folderName)) {
			mutationGroup.items.one(folderName).items.add(item.item);
		} else {
			mutationGroup.items.add({
				id: folderName,
				name: folder,
				item: [item.item],
			});
		}
	} else {
		const folderName = `${folder}Queries`;
		if (queryGroup.items.one(folderName)) {
			queryGroup.items.one(folderName).items.add(item.item);
		} else {
			queryGroup.items.add({
				id: folderName,
				name: folder,
				item: [item.item],
			});
		}
	}
};
// TS types of these modules are so bad, I opt out!
// docs: https://www.postmanlabs.com/postman-collection/

export const PostmanBuilder = (operations: GraphQLOperation[], options: PostmanBuilderOptions) => {
	const queryGroup = new Collection();
	queryGroup.id = 'Queries';
	queryGroup.name = 'Queries';
	queryGroup.describe('All your query operations');

	const mutationGroup = new Collection();
	mutationGroup.id = 'Mutations';
	mutationGroup.name = 'Mutations';
	mutationGroup.describe('All your mutation operations');

	operations.forEach((op) => {
		const operationURL = `{{apiBaseUrl}}/operations/${op.PathName}`;

		const folders = op.PathName.split('/');

		if (folders.length === 1) {
			const item = buildItem(op, operationURL, op.PathName);
			if (item.isMutation) {
				mutationGroup.items.add(item.item);
			} else {
				queryGroup.items.add(item.item);
			}
		} else {
			const opName = folders.slice(-1)[0];
			const item = buildItem(op, operationURL, opName);
			const justFolders = folders.slice(0, -1);
			for (const folder of justFolders) {
				addItemToFolder({ item, folder, mutationGroup, queryGroup });
			}
		}
	});

	const myCollection = new Collection();
	myCollection.id = 'Wundergraph';
	myCollection.describe('Your Wundergraph collection');
	myCollection.name = 'Wundergraph';

	// add variables
	myCollection.variables.add({
		key: 'apiBaseUrl',
		value: options.baseURL,
		type: 'string',
	});

	// add sub collections
	myCollection.items.add(queryGroup.toJSON());
	myCollection.items.add(mutationGroup.toJSON());

	return myCollection;
};

const mutationRequestJson = (url: string, paths: JSONSchemaParameterPath[]): string => {
	const request = new Request({
		url: url,
		method: 'POST',
		body: {
			mode: 'urlencoded',
			urlencoded: [],
			description: 'Your GraphQL variables in JSON',
		},
	});

	for (const path of paths) {
		request.body?.urlencoded.add({
			key: path.path.join('.'),
			disabled: !path.required,
			description: `Type ${path.type}, ${path.required ? 'Required' : 'Optional'}`,
			value: '',
			type: 'text',
		});
	}

	return request.toJSON();
};

const queryRequestJson = (url: string, paths: JSONSchemaParameterPath[]): string => {
	const request = new Request({
		url: url,
		method: 'GET',
	});
	request.addHeader({
		key: 'Content-Type',
		value: 'application/json',
	});

	for (const path of paths) {
		request.addQueryParams([
			{
				key: path.path.join('.'),
				disabled: !path.required,
				value: '',
				description: `Type ${path.type}, ${path.required ? 'Required' : 'Optional'}`,
			},
		]);
	}

	return request.toJSON();
};

// TODO: Add "default" values
// path syntax follows https://github.com/tidwall/sjson#path-syntax
export function buildPath(
	path: string[],
	required: boolean,
	obj: JSONSchema7Definition,
	paths: JSONSchemaParameterPath[]
) {
	if (typeof obj === 'boolean') return;

	if (obj.type === 'array') {
		if (typeof obj.items === 'boolean') return;
		if (!obj.items) return;

		let items = [];
		if (!Array.isArray(obj.items)) items.push(obj.items);
		items.forEach((obj, index) => buildPath([...path, index.toString()], false, obj, paths));
		return;
	}

	// those nodes are limited due to recursion
	if (!obj.type) return;

	if (obj.properties) {
		Object.keys(obj.properties).forEach((key) => {
			if (obj.properties) {
				buildPath([...path, key], obj.required?.includes(key) || required, obj.properties[key], paths);
			}
		});
		return;
	}

	paths.push({
		path,
		required: false, // ignore it for now because this would make all variants required
		type: typeof obj.type === 'string' ? obj.type : 'any',
	});

	paths.sort(function (a, b) {
		return a.path.length - b.path.length;
	});
}
