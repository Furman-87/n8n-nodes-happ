import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	IPollFunctions,
} from 'n8n-workflow';

export async function happApiRequest(
	this: IExecuteFunctions | ILoadOptionsFunctions | IPollFunctions,
	method: IHttpRequestMethods,
	endpoint: string,
	qs: IDataObject = {},
): Promise<unknown> {
	const credentials = await this.getCredentials('happApi');
	const options: IHttpRequestOptions = {
		method,
		url: `${credentials.baseUrl as string}${endpoint}`,
		qs,
		json: true,
	};
	return await this.helpers.httpRequestWithAuthentication.call(this, 'happApi', options);
}

export function toListItems(response: unknown): IDataObject[] {
	if (Array.isArray(response)) return response as IDataObject[];
	const data = (response as IDataObject | null)?.data;
	if (Array.isArray(data)) return data as IDataObject[];
	return [];
}
