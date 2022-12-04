//language=handlebars
export const template = `
/* eslint-disable */
import { WebhookConfiguration } from '@wundergraph/sdk';

export type WebhooksConfig = {
{{#each webhooks}}
		{{name}}?: WebhookConfiguration;
{{/each}}
}
`;
