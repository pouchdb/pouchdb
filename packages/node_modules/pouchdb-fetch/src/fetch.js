'use strict';

import nodeFetch, {Headers} from 'node-fetch';
import fetchCookie from 'fetch-cookie';
import AbortController from 'abort-controller';

var fetch = fetchCookie(nodeFetch);

export {fetch, Headers, AbortController};
