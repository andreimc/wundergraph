import fs from 'fs/promises';
import { GraphQLApi, introspect } from './index';

jest.mock('fs/promises');

const schema = `
schema {
	query: Query
}

type Query {
	user: User
}

interface User {
    id: ID!
    displayName: String!
    isLoggedIn: Boolean!
}

type RegisteredUser implements User {
    id: ID!
    displayName: String!
    isLoggedIn: Boolean!
	hasVerifiedEmail: Boolean!
}
`;

describe('Introspection', () => {
	beforeEach(() => {
		// Reset mocks
		jest.resetAllMocks();
	});

	test('introspect GraphQL API with interface type definitions', async () => {
		fs.writeFile = jest.fn().mockResolvedValue(undefined);

		const api: GraphQLApi = await introspect.graphql({
			apiNamespace: 'api',
			loadSchemaFromString: schema,
			url: 'http://localhost:8080/graphql',
		})();
		expect(api).toMatchSnapshot();
	});
});
