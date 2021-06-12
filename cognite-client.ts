import { config as dotenvConfig } from 'dotenv';
import { CogniteClient } from '@cognite/sdk';

dotenvConfig();

export const cogniteClient = new CogniteClient({appId: 'myapp'});

cogniteClient.loginWithApiKey({
  project: process.env.CDF_PROJECT!,
  apiKey: process.env.CDF_API_KEY!,
});
