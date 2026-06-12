import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class HappApi implements ICredentialType {
	name = 'happApi';

	displayName = 'Happ API';

	// eslint-disable-next-line n8n-nodes-base/cred-class-field-documentation-url-miscased
	documentationUrl = 'https://docs.happ.tools/en/docs/api';

	properties: INodeProperties[] = [
		{
			displayName: 'Access Token',
			name: 'accessToken',
			type: 'string',
			typeOptions: { password: true },
			required: true,
			default: '',
			description:
				'Company-scoped access token (format: happ_...). Generate one at my.happ.tools or via POST /api/companies/{companyId}/access-tokens.',
		},
		{
			displayName: 'Environment',
			name: 'baseUrl',
			type: 'options',
			options: [
				{
					name: 'Production',
					value: 'https://api.happ.tools',
				},
				{
					name: 'Development',
					value: 'https://api.dev.happ.tools',
				},
			],
			default: 'https://api.happ.tools',
			description: 'API environment to connect to. Use Production for live data.',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				'X-Access-Token': '={{$credentials.accessToken}}',
			},
		},
	};

	// /api/companies/my is user-scoped (JWT only) and rejects company-scoped
	// access tokens, so the test uses a company-scoped endpoint instead.
	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl}}',
			url: '/api/chats/messengers',
		},
	};
}
