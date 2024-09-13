'use strict';

import nodeFetch, {Headers} from 'node-fetch';
import fetchCookie from 'fetch-cookie';

var fetch = fetchCookie(nodeFetch);

export { fetch, Headers };
