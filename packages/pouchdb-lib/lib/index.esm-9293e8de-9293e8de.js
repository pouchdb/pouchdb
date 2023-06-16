/*!
 * hash-wasm (https://www.npmjs.com/package/hash-wasm)
 * (c) Dani Biro
 * @license MIT
 */

/*! *****************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */

function __awaiter(thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
}

class Mutex {
    constructor() {
        this.mutex = Promise.resolve();
    }
    lock() {
        let begin = () => { };
        this.mutex = this.mutex.then(() => new Promise(begin));
        return new Promise((res) => {
            begin = res;
        });
    }
    dispatch(fn) {
        return __awaiter(this, void 0, void 0, function* () {
            const unlock = yield this.lock();
            try {
                return yield Promise.resolve(fn());
            }
            finally {
                unlock();
            }
        });
    }
}

/* eslint-disable import/prefer-default-export */
/* eslint-disable no-bitwise */
var _a;
function getGlobal() {
    if (typeof globalThis !== 'undefined')
        return globalThis;
    // eslint-disable-next-line no-restricted-globals
    if (typeof self !== 'undefined')
        return self;
    if (typeof window !== 'undefined')
        return window;
    return global;
}
const globalObject = getGlobal();
const nodeBuffer = (_a = globalObject.Buffer) !== null && _a !== void 0 ? _a : null;
const textEncoder = globalObject.TextEncoder ? new globalObject.TextEncoder() : null;
function intArrayToString(arr, len) {
    return String.fromCharCode(...arr.subarray(0, len));
}
function hexCharCodesToInt(a, b) {
    return (((a & 0xF) + ((a >> 6) | ((a >> 3) & 0x8))) << 4) | ((b & 0xF) + ((b >> 6) | ((b >> 3) & 0x8)));
}
function writeHexToUInt8(buf, str) {
    const size = str.length >> 1;
    for (let i = 0; i < size; i++) {
        const index = i << 1;
        buf[i] = hexCharCodesToInt(str.charCodeAt(index), str.charCodeAt(index + 1));
    }
}
function hexStringEqualsUInt8(str, buf) {
    if (str.length !== buf.length * 2) {
        return false;
    }
    for (let i = 0; i < buf.length; i++) {
        const strIndex = i << 1;
        if (buf[i] !== hexCharCodesToInt(str.charCodeAt(strIndex), str.charCodeAt(strIndex + 1))) {
            return false;
        }
    }
    return true;
}
const alpha = 'a'.charCodeAt(0) - 10;
const digit = '0'.charCodeAt(0);
function getDigestHex(tmpBuffer, input, hashLength) {
    let p = 0;
    /* eslint-disable no-plusplus */
    for (let i = 0; i < hashLength; i++) {
        let nibble = input[i] >>> 4;
        tmpBuffer[p++] = nibble > 9 ? nibble + alpha : nibble + digit;
        nibble = input[i] & 0xF;
        tmpBuffer[p++] = nibble > 9 ? nibble + alpha : nibble + digit;
    }
    /* eslint-enable no-plusplus */
    return String.fromCharCode.apply(null, tmpBuffer);
}
const getUInt8Buffer = nodeBuffer !== null
    ? (data) => {
        if (typeof data === 'string') {
            const buf = nodeBuffer.from(data, 'utf8');
            return new Uint8Array(buf.buffer, buf.byteOffset, buf.length);
        }
        if (nodeBuffer.isBuffer(data)) {
            return new Uint8Array(data.buffer, data.byteOffset, data.length);
        }
        if (ArrayBuffer.isView(data)) {
            return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
        }
        throw new Error('Invalid data type!');
    }
    : (data) => {
        if (typeof data === 'string') {
            return textEncoder.encode(data);
        }
        if (ArrayBuffer.isView(data)) {
            return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
        }
        throw new Error('Invalid data type!');
    };
const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const base64Lookup = new Uint8Array(256);
for (let i = 0; i < base64Chars.length; i++) {
    base64Lookup[base64Chars.charCodeAt(i)] = i;
}
function encodeBase64(data, pad = true) {
    const len = data.length;
    const extraBytes = len % 3;
    const parts = [];
    const len2 = len - extraBytes;
    for (let i = 0; i < len2; i += 3) {
        const tmp = ((data[i] << 16) & 0xFF0000)
            + ((data[i + 1] << 8) & 0xFF00)
            + (data[i + 2] & 0xFF);
        const triplet = base64Chars.charAt((tmp >> 18) & 0x3F)
            + base64Chars.charAt((tmp >> 12) & 0x3F)
            + base64Chars.charAt((tmp >> 6) & 0x3F)
            + base64Chars.charAt(tmp & 0x3F);
        parts.push(triplet);
    }
    if (extraBytes === 1) {
        const tmp = data[len - 1];
        const a = base64Chars.charAt(tmp >> 2);
        const b = base64Chars.charAt((tmp << 4) & 0x3F);
        parts.push(`${a}${b}`);
        if (pad) {
            parts.push('==');
        }
    }
    else if (extraBytes === 2) {
        const tmp = (data[len - 2] << 8) + data[len - 1];
        const a = base64Chars.charAt(tmp >> 10);
        const b = base64Chars.charAt((tmp >> 4) & 0x3F);
        const c = base64Chars.charAt((tmp << 2) & 0x3F);
        parts.push(`${a}${b}${c}`);
        if (pad) {
            parts.push('=');
        }
    }
    return parts.join('');
}
function getDecodeBase64Length(data) {
    let bufferLength = Math.floor(data.length * 0.75);
    const len = data.length;
    if (data[len - 1] === '=') {
        bufferLength -= 1;
        if (data[len - 2] === '=') {
            bufferLength -= 1;
        }
    }
    return bufferLength;
}
function decodeBase64(data) {
    const bufferLength = getDecodeBase64Length(data);
    const len = data.length;
    const bytes = new Uint8Array(bufferLength);
    let p = 0;
    for (let i = 0; i < len; i += 4) {
        const encoded1 = base64Lookup[data.charCodeAt(i)];
        const encoded2 = base64Lookup[data.charCodeAt(i + 1)];
        const encoded3 = base64Lookup[data.charCodeAt(i + 2)];
        const encoded4 = base64Lookup[data.charCodeAt(i + 3)];
        bytes[p] = (encoded1 << 2) | (encoded2 >> 4);
        p += 1;
        bytes[p] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
        p += 1;
        bytes[p] = ((encoded3 & 3) << 6) | (encoded4 & 63);
        p += 1;
    }
    return bytes;
}

const MAX_HEAP = 16 * 1024;
const WASM_FUNC_HASH_LENGTH = 4;
const wasmMutex = new Mutex();
const wasmModuleCache = new Map();
function WASMInterface(binary, hashLength) {
    return __awaiter(this, void 0, void 0, function* () {
        let wasmInstance = null;
        let memoryView = null;
        let initialized = false;
        if (typeof WebAssembly === 'undefined') {
            throw new Error('WebAssembly is not supported in this environment!');
        }
        const writeMemory = (data, offset = 0) => {
            memoryView.set(data, offset);
        };
        const getMemory = () => memoryView;
        const getExports = () => wasmInstance.exports;
        const setMemorySize = (totalSize) => {
            wasmInstance.exports.Hash_SetMemorySize(totalSize);
            const arrayOffset = wasmInstance.exports.Hash_GetBuffer();
            const memoryBuffer = wasmInstance.exports.memory.buffer;
            memoryView = new Uint8Array(memoryBuffer, arrayOffset, totalSize);
        };
        const getStateSize = () => {
            const view = new DataView(wasmInstance.exports.memory.buffer);
            const stateSize = view.getUint32(wasmInstance.exports.STATE_SIZE, true);
            return stateSize;
        };
        const loadWASMPromise = wasmMutex.dispatch(() => __awaiter(this, void 0, void 0, function* () {
            if (!wasmModuleCache.has(binary.name)) {
                const asm = decodeBase64(binary.data);
                const promise = WebAssembly.compile(asm);
                wasmModuleCache.set(binary.name, promise);
            }
            const module = yield wasmModuleCache.get(binary.name);
            wasmInstance = yield WebAssembly.instantiate(module, {
            // env: {
            //   emscripten_memcpy_big: (dest, src, num) => {
            //     const memoryBuffer = wasmInstance.exports.memory.buffer;
            //     const memView = new Uint8Array(memoryBuffer, 0);
            //     memView.set(memView.subarray(src, src + num), dest);
            //   },
            //   print_memory: (offset, len) => {
            //     const memoryBuffer = wasmInstance.exports.memory.buffer;
            //     const memView = new Uint8Array(memoryBuffer, 0);
            //     console.log('print_int32', memView.subarray(offset, offset + len));
            //   },
            // },
            });
            // wasmInstance.exports._start();
        }));
        const setupInterface = () => __awaiter(this, void 0, void 0, function* () {
            if (!wasmInstance) {
                yield loadWASMPromise;
            }
            const arrayOffset = wasmInstance.exports.Hash_GetBuffer();
            const memoryBuffer = wasmInstance.exports.memory.buffer;
            memoryView = new Uint8Array(memoryBuffer, arrayOffset, MAX_HEAP);
        });
        const init = (bits = null) => {
            initialized = true;
            wasmInstance.exports.Hash_Init(bits);
        };
        const updateUInt8Array = (data) => {
            let read = 0;
            while (read < data.length) {
                const chunk = data.subarray(read, read + MAX_HEAP);
                read += chunk.length;
                memoryView.set(chunk);
                wasmInstance.exports.Hash_Update(chunk.length);
            }
        };
        const update = (data) => {
            if (!initialized) {
                throw new Error('update() called before init()');
            }
            const Uint8Buffer = getUInt8Buffer(data);
            updateUInt8Array(Uint8Buffer);
        };
        const digestChars = new Uint8Array(hashLength * 2);
        const digest = (outputType, padding = null) => {
            if (!initialized) {
                throw new Error('digest() called before init()');
            }
            initialized = false;
            wasmInstance.exports.Hash_Final(padding);
            if (outputType === 'binary') {
                // the data is copied to allow GC of the original memory object
                return memoryView.slice(0, hashLength);
            }
            return getDigestHex(digestChars, memoryView, hashLength);
        };
        const save = () => {
            if (!initialized) {
                throw new Error('save() can only be called after init() and before digest()');
            }
            const stateOffset = wasmInstance.exports.Hash_GetState();
            const stateLength = getStateSize();
            const memoryBuffer = wasmInstance.exports.memory.buffer;
            const internalState = new Uint8Array(memoryBuffer, stateOffset, stateLength);
            // prefix is 4 bytes from SHA1 hash of the WASM binary
            // it is used to detect incompatible internal states between different versions of hash-wasm
            const prefixedState = new Uint8Array(WASM_FUNC_HASH_LENGTH + stateLength);
            writeHexToUInt8(prefixedState, binary.hash);
            prefixedState.set(internalState, WASM_FUNC_HASH_LENGTH);
            return prefixedState;
        };
        const load = (state) => {
            if (!(state instanceof Uint8Array)) {
                throw new Error('load() expects an Uint8Array generated by save()');
            }
            const stateOffset = wasmInstance.exports.Hash_GetState();
            const stateLength = getStateSize();
            const overallLength = WASM_FUNC_HASH_LENGTH + stateLength;
            const memoryBuffer = wasmInstance.exports.memory.buffer;
            if (state.length !== overallLength) {
                throw new Error(`Bad state length (expected ${overallLength} bytes, got ${state.length})`);
            }
            if (!hexStringEqualsUInt8(binary.hash, state.subarray(0, WASM_FUNC_HASH_LENGTH))) {
                throw new Error('This state was written by an incompatible hash implementation');
            }
            const internalState = state.subarray(WASM_FUNC_HASH_LENGTH);
            new Uint8Array(memoryBuffer, stateOffset, stateLength).set(internalState);
            initialized = true;
        };
        const isDataShort = (data) => {
            if (typeof data === 'string') {
                // worst case is 4 bytes / char
                return data.length < MAX_HEAP / 4;
            }
            return data.byteLength < MAX_HEAP;
        };
        let canSimplify = isDataShort;
        switch (binary.name) {
            case 'argon2':
            case 'scrypt':
                canSimplify = () => true;
                break;
            case 'blake2b':
            case 'blake2s':
                // if there is a key at blake2 then cannot simplify
                canSimplify = (data, initParam) => initParam <= 512 && isDataShort(data);
                break;
            case 'blake3':
                // if there is a key at blake3 then cannot simplify
                canSimplify = (data, initParam) => initParam === 0 && isDataShort(data);
                break;
            case 'xxhash64': // cannot simplify
            case 'xxhash3':
            case 'xxhash128':
                canSimplify = () => false;
                break;
        }
        // shorthand for (init + update + digest) for better performance
        const calculate = (data, initParam = null, digestParam = null) => {
            if (!canSimplify(data, initParam)) {
                init(initParam);
                update(data);
                return digest('hex', digestParam);
            }
            const buffer = getUInt8Buffer(data);
            memoryView.set(buffer);
            wasmInstance.exports.Hash_Calculate(buffer.length, initParam, digestParam);
            return getDigestHex(digestChars, memoryView, hashLength);
        };
        yield setupInterface();
        return {
            getMemory,
            writeMemory,
            getExports,
            setMemorySize,
            init,
            update,
            digest,
            save,
            load,
            calculate,
            hashLength,
        };
    });
}

var name$k = "adler32";
var data$k = "AGFzbQEAAAABDANgAAF/YAAAYAF/AAMHBgABAgEAAgQFAXABAQEFBAEBAgIGDgJ/AUGAiQULfwBBgAgLB3AIBm1lbW9yeQIADkhhc2hfR2V0QnVmZmVyAAAJSGFzaF9Jbml0AAELSGFzaF9VcGRhdGUAAgpIYXNoX0ZpbmFsAAMNSGFzaF9HZXRTdGF0ZQAEDkhhc2hfQ2FsY3VsYXRlAAUKU1RBVEVfU0laRQMBCoAIBgUAQYAJCwoAQQBBATYChAgL9gYBBn9BACgChAgiAUH//wNxIQIgAUEQdiEDAkACQCAAQQFHDQAgAkEALQCACWoiAUGPgHxqIAEgAUHw/wNLGyIBIANqIgRBEHQiBUGAgDxqIAUgBEHw/wNLGyABciEBDAELAkACQAJAAkACQCAAQRBJDQBBgAkhBiAAQbArSQ0BQYAJIQYDQEEAIQUDQCAGIAVqIgEoAgAiBEH/AXEgAmoiAiADaiACIARBCHZB/wFxaiICaiACIARBEHZB/wFxaiICaiACIARBGHZqIgJqIAIgAUEEaigCACIEQf8BcWoiAmogAiAEQQh2Qf8BcWoiAmogAiAEQRB2Qf8BcWoiAmogAiAEQRh2aiICaiACIAFBCGooAgAiBEH/AXFqIgJqIAIgBEEIdkH/AXFqIgJqIAIgBEEQdkH/AXFqIgJqIAIgBEEYdmoiBGogBCABQQxqKAIAIgFB/wFxaiIEaiAEIAFBCHZB/wFxaiIEaiAEIAFBEHZB/wFxaiIEaiAEIAFBGHZqIgJqIQMgBUEQaiIFQbArRw0ACyADQfH/A3AhAyACQfH/A3AhAiAGQbAraiEGIABB0FRqIgBBrytLDQALIABFDQQgAEEPSw0BDAILAkAgAEUNAEEAIQEDQCACIAFBgAlqLQAAaiICIANqIQMgACABQQFqIgFHDQALCyACQY+AfGogAiACQfD/A0sbIANB8f8DcEEQdHIhAQwECwNAIAYoAgAiAUH/AXEgAmoiBCADaiAEIAFBCHZB/wFxaiIEaiAEIAFBEHZB/wFxaiIEaiAEIAFBGHZqIgRqIAQgBkEEaigCACIBQf8BcWoiBGogBCABQQh2Qf8BcWoiBGogBCABQRB2Qf8BcWoiBGogBCABQRh2aiIEaiAEIAZBCGooAgAiAUH/AXFqIgRqIAQgAUEIdkH/AXFqIgRqIAQgAUEQdkH/AXFqIgRqIAQgAUEYdmoiBGogBCAGQQxqKAIAIgFB/wFxaiIEaiAEIAFBCHZB/wFxaiIEaiAEIAFBEHZB/wFxaiIEaiAEIAFBGHZqIgJqIQMgBkEQaiEGIABBcGoiAEEPSw0ACyAARQ0BCwNAIAIgBi0AAGoiAiADaiEDIAZBAWohBiAAQX9qIgANAAsLIANB8f8DcCEDIAJB8f8DcCECCyACIANBEHRyIQELQQAgATYChAgLMgEBf0EAQQAoAoQIIgBBGHQgAEEIdEGAgPwHcXIgAEEIdkGA/gNxIABBGHZycjYCgAkLBQBBhAgLPABBAEEBNgKECCAAEAJBAEEAKAKECCIAQRh0IABBCHRBgID8B3FyIABBCHZBgP4DcSAAQRh2cnI2AoAJCwsVAgBBgAgLBAQAAAAAQYQICwQBAAAA";
var hash$k = "321174b4";
var wasmJson$k = {
	name: name$k,
	data: data$k,
	hash: hash$k
};

function lockedCreate(mutex, binary, hashLength) {
    return __awaiter(this, void 0, void 0, function* () {
        const unlock = yield mutex.lock();
        const wasm = yield WASMInterface(binary, hashLength);
        unlock();
        return wasm;
    });
}

const mutex$l = new Mutex();
let wasmCache$l = null;
/**
 * Calculates Adler-32 hash. The resulting 32-bit hash is stored in
 * network byte order (big-endian).
 *
 * @param data Input data (string, Buffer or TypedArray)
 * @returns Computed hash as a hexadecimal string
 */
function adler32(data) {
    if (wasmCache$l === null) {
        return lockedCreate(mutex$l, wasmJson$k, 4)
            .then((wasm) => {
            wasmCache$l = wasm;
            return wasmCache$l.calculate(data);
        });
    }
    try {
        const hash = wasmCache$l.calculate(data);
        return Promise.resolve(hash);
    }
    catch (err) {
        return Promise.reject(err);
    }
}
/**
 * Creates a new Adler-32 hash instance
 */
function createAdler32() {
    return WASMInterface(wasmJson$k, 4).then((wasm) => {
        wasm.init();
        const obj = {
            init: () => { wasm.init(); return obj; },
            update: (data) => { wasm.update(data); return obj; },
            digest: (outputType) => wasm.digest(outputType),
            save: () => wasm.save(),
            load: (data) => { wasm.load(data); return obj; },
            blockSize: 4,
            digestSize: 4,
        };
        return obj;
    });
}

var name$j = "blake2b";
var data$j = "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";
var hash$j = "68afc9cf";
var wasmJson$j = {
	name: name$j,
	data: data$j,
	hash: hash$j
};

const mutex$k = new Mutex();
let wasmCache$k = null;
function validateBits$4(bits) {
    if (!Number.isInteger(bits) || bits < 8 || bits > 512 || bits % 8 !== 0) {
        return new Error('Invalid variant! Valid values: 8, 16, ..., 512');
    }
    return null;
}
function getInitParam$1(outputBits, keyBits) {
    // eslint-disable-next-line no-bitwise
    return outputBits | (keyBits << 16);
}
/**
 * Calculates BLAKE2b hash
 * @param data Input data (string, Buffer or TypedArray)
 * @param bits Number of output bits, which has to be a number
 *             divisible by 8, between 8 and 512. Defaults to 512.
 * @param key Optional key (string, Buffer or TypedArray). Maximum length is 64 bytes.
 * @returns Computed hash as a hexadecimal string
 */
function blake2b(data, bits = 512, key = null) {
    if (validateBits$4(bits)) {
        return Promise.reject(validateBits$4(bits));
    }
    let keyBuffer = null;
    let initParam = bits;
    if (key !== null) {
        keyBuffer = getUInt8Buffer(key);
        if (keyBuffer.length > 64) {
            return Promise.reject(new Error('Max key length is 64 bytes'));
        }
        initParam = getInitParam$1(bits, keyBuffer.length);
    }
    const hashLength = bits / 8;
    if (wasmCache$k === null || wasmCache$k.hashLength !== hashLength) {
        return lockedCreate(mutex$k, wasmJson$j, hashLength)
            .then((wasm) => {
            wasmCache$k = wasm;
            if (initParam > 512) {
                wasmCache$k.writeMemory(keyBuffer);
            }
            return wasmCache$k.calculate(data, initParam);
        });
    }
    try {
        if (initParam > 512) {
            wasmCache$k.writeMemory(keyBuffer);
        }
        const hash = wasmCache$k.calculate(data, initParam);
        return Promise.resolve(hash);
    }
    catch (err) {
        return Promise.reject(err);
    }
}
/**
 * Creates a new BLAKE2b hash instance
 * @param bits Number of output bits, which has to be a number
 *             divisible by 8, between 8 and 512. Defaults to 512.
 * @param key Optional key (string, Buffer or TypedArray). Maximum length is 64 bytes.
 */
function createBLAKE2b(bits = 512, key = null) {
    if (validateBits$4(bits)) {
        return Promise.reject(validateBits$4(bits));
    }
    let keyBuffer = null;
    let initParam = bits;
    if (key !== null) {
        keyBuffer = getUInt8Buffer(key);
        if (keyBuffer.length > 64) {
            return Promise.reject(new Error('Max key length is 64 bytes'));
        }
        initParam = getInitParam$1(bits, keyBuffer.length);
    }
    const outputSize = bits / 8;
    return WASMInterface(wasmJson$j, outputSize).then((wasm) => {
        if (initParam > 512) {
            wasm.writeMemory(keyBuffer);
        }
        wasm.init(initParam);
        const obj = {
            init: initParam > 512
                ? () => {
                    wasm.writeMemory(keyBuffer);
                    wasm.init(initParam);
                    return obj;
                }
                : () => {
                    wasm.init(initParam);
                    return obj;
                },
            update: (data) => { wasm.update(data); return obj; },
            digest: (outputType) => wasm.digest(outputType),
            save: () => wasm.save(),
            load: (data) => { wasm.load(data); return obj; },
            blockSize: 128,
            digestSize: outputSize,
        };
        return obj;
    });
}

var name$i = "argon2";
var data$i = "AGFzbQEAAAABKQVgAX8Bf2AAAX9gEH9/f39/f39/f39/f39/f38AYAR/f39/AGACf38AAwYFAAECAwQEBQFwAQEBBQYBAQKAgAIGCAF/AUGQqAQLB0EEBm1lbW9yeQIAEkhhc2hfU2V0TWVtb3J5U2l6ZQAADkhhc2hfR2V0QnVmZmVyAAEOSGFzaF9DYWxjdWxhdGUABArXMwVbAQF/QQAhAQJAIABBACgCgAhrIgBFDQACQCAAQRB2IABBgIB8cSAASWoiAEAAQX9HDQBB/wEhAQwBC0EAIQFBAEEAKQOACCAAQRB0rXw3A4AICyABQRh0QRh1C2oBAn8CQEEAKAKICCIADQBBAD8AQRB0IgA2AogIQYCAIEEAKAKACGsiAUUNAAJAIAFBEHYgAUGAgHxxIAFJaiIAQABBf0cNAEEADwtBAEEAKQOACCAAQRB0rXw3A4AIQQAoAogIIQALIAALnA8BA34gACAEKQMAIhAgACkDACIRfCARQgGGQv7///8fgyAQQv////8Pg358IhA3AwAgDCAQIAwpAwCFIhBCIIkiETcDACAIIBEgCCkDACISfCASQgGGQv7///8fgyAQQiCIfnwiEDcDACAEIBAgBCkDAIUiEEIoiSIRNwMAIAAgESAAKQMAIhJ8IBBCGIhC/////w+DIBJCAYZC/v///x+DfnwiEDcDACAMIBAgDCkDAIUiEEIwiSIRNwMAIAggESAIKQMAIhJ8IBBCEIhC/////w+DIBJCAYZC/v///x+DfnwiEDcDACAEIBAgBCkDAIVCAYk3AwAgASAFKQMAIhAgASkDACIRfCARQgGGQv7///8fgyAQQv////8Pg358IhA3AwAgDSAQIA0pAwCFIhBCIIkiETcDACAJIBEgCSkDACISfCASQgGGQv7///8fgyAQQiCIfnwiEDcDACAFIBAgBSkDAIUiEEIoiSIRNwMAIAEgESABKQMAIhJ8IBBCGIhC/////w+DIBJCAYZC/v///x+DfnwiEDcDACANIBAgDSkDAIUiEEIwiSIRNwMAIAkgESAJKQMAIhJ8IBBCEIhC/////w+DIBJCAYZC/v///x+DfnwiEDcDACAFIBAgBSkDAIVCAYk3AwAgAiAGKQMAIhAgAikDACIRfCARQgGGQv7///8fgyAQQv////8Pg358IhA3AwAgDiAQIA4pAwCFIhBCIIkiETcDACAKIBEgCikDACISfCASQgGGQv7///8fgyAQQiCIfnwiEDcDACAGIBAgBikDAIUiEEIoiSIRNwMAIAIgESACKQMAIhJ8IBBCGIhC/////w+DIBJCAYZC/v///x+DfnwiEDcDACAOIBAgDikDAIUiEEIwiSIRNwMAIAogESAKKQMAIhJ8IBBCEIhC/////w+DIBJCAYZC/v///x+DfnwiEDcDACAGIBAgBikDAIVCAYk3AwAgAyAHKQMAIhAgAykDACIRfCARQgGGQv7///8fgyAQQv////8Pg358IhA3AwAgDyAQIA8pAwCFIhBCIIkiETcDACALIBEgCykDACISfCASQgGGQv7///8fgyAQQiCIfnwiEDcDACAHIBAgBykDAIUiEEIoiSIRNwMAIAMgESADKQMAIhJ8IBBCGIhC/////w+DIBJCAYZC/v///x+DfnwiEDcDACAPIBAgDykDAIUiEEIwiSIRNwMAIAsgESALKQMAIhJ8IBBCEIhC/////w+DIBJCAYZC/v///x+DfnwiEDcDACAHIBAgBykDAIVCAYk3AwAgACAFKQMAIhAgACkDACIRfCARQgGGQv7///8fgyAQQv////8Pg358IhA3AwAgDyAQIA8pAwCFIhBCIIkiETcDACAKIBEgCikDACISfCASQgGGQv7///8fgyAQQiCIfnwiEDcDACAFIBAgBSkDAIUiEEIoiSIRNwMAIAAgESAAKQMAIhJ8IBBCGIhC/////w+DIBJCAYZC/v///x+DfnwiEDcDACAPIBAgDykDAIUiEEIwiSIRNwMAIAogESAKKQMAIhJ8IBBCEIhC/////w+DIBJCAYZC/v///x+DfnwiEDcDACAFIBAgBSkDAIVCAYk3AwAgASAGKQMAIhAgASkDACIRfCARQgGGQv7///8fgyAQQv////8Pg358IhA3AwAgDCAQIAwpAwCFIhBCIIkiETcDACALIBEgCykDACISfCASQgGGQv7///8fgyAQQiCIfnwiEDcDACAGIBAgBikDAIUiEEIoiSIRNwMAIAEgESABKQMAIhJ8IBBCGIhC/////w+DIBJCAYZC/v///x+DfnwiEDcDACAMIBAgDCkDAIUiEEIwiSIRNwMAIAsgESALKQMAIhJ8IBBCEIhC/////w+DIBJCAYZC/v///x+DfnwiEDcDACAGIBAgBikDAIVCAYk3AwAgAiAHKQMAIhAgAikDACIRfCARQgGGQv7///8fgyAQQv////8Pg358IhA3AwAgDSAQIA0pAwCFIhBCIIkiETcDACAIIBEgCCkDACISfCASQgGGQv7///8fgyAQQiCIfnwiEDcDACAHIBAgBykDAIUiEEIoiSIRNwMAIAIgESACKQMAIhJ8IBBCGIhC/////w+DIBJCAYZC/v///x+DfnwiEDcDACANIBAgDSkDAIUiEEIwiSIRNwMAIAggESAIKQMAIhJ8IBBCEIhC/////w+DIBJCAYZC/v///x+DfnwiEDcDACAHIBAgBykDAIVCAYk3AwAgAyAEKQMAIhAgAykDACIRfCARQgGGQv7///8fgyAQQv////8Pg358IhA3AwAgDiAQIA4pAwCFIhBCIIkiETcDACAJIBEgCSkDACISfCASQgGGQv7///8fgyAQQiCIfnwiEDcDACAEIBAgBCkDAIUiEEIoiSIRNwMAIAMgESADKQMAIhJ8IBBCGIhC/////w+DIBJCAYZC/v///x+DfnwiEDcDACAOIBAgDikDAIUiEEIwiSIRNwMAIAkgESAJKQMAIhJ8IBBCEIhC/////w+DIBJCAYZC/v///x+DfnwiEDcDACAEIBAgBCkDAIVCAYk3AwALhxoBAX9BACEEQQAgAikDACABKQMAhTcDkAhBACACKQMIIAEpAwiFNwOYCEEAIAIpAxAgASkDEIU3A6AIQQAgAikDGCABKQMYhTcDqAhBACACKQMgIAEpAyCFNwOwCEEAIAIpAyggASkDKIU3A7gIQQAgAikDMCABKQMwhTcDwAhBACACKQM4IAEpAziFNwPICEEAIAIpA0AgASkDQIU3A9AIQQAgAikDSCABKQNIhTcD2AhBACACKQNQIAEpA1CFNwPgCEEAIAIpA1ggASkDWIU3A+gIQQAgAikDYCABKQNghTcD8AhBACACKQNoIAEpA2iFNwP4CEEAIAIpA3AgASkDcIU3A4AJQQAgAikDeCABKQN4hTcDiAlBACACKQOAASABKQOAAYU3A5AJQQAgAikDiAEgASkDiAGFNwOYCUEAIAIpA5ABIAEpA5ABhTcDoAlBACACKQOYASABKQOYAYU3A6gJQQAgAikDoAEgASkDoAGFNwOwCUEAIAIpA6gBIAEpA6gBhTcDuAlB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";
var hash$i = "59aa4fb4";
var wasmJson$i = {
	name: name$i,
	data: data$i,
	hash: hash$i
};

function encodeResult(salt, options, res) {
    const parameters = [
        `m=${options.memorySize}`,
        `t=${options.iterations}`,
        `p=${options.parallelism}`,
    ].join(',');
    return `$argon2${options.hashType}$v=19$${parameters}$${encodeBase64(salt, false)}$${encodeBase64(res, false)}`;
}
const uint32View = new DataView(new ArrayBuffer(4));
function int32LE(x) {
    uint32View.setInt32(0, x, true);
    return new Uint8Array(uint32View.buffer);
}
function hashFunc(blake512, buf, len) {
    return __awaiter(this, void 0, void 0, function* () {
        if (len <= 64) {
            const blake = yield createBLAKE2b(len * 8);
            blake.update(int32LE(len));
            blake.update(buf);
            return blake.digest('binary');
        }
        const r = Math.ceil(len / 32) - 2;
        const ret = new Uint8Array(len);
        blake512.init();
        blake512.update(int32LE(len));
        blake512.update(buf);
        let vp = blake512.digest('binary');
        ret.set(vp.subarray(0, 32), 0);
        for (let i = 1; i < r; i++) {
            blake512.init();
            blake512.update(vp);
            vp = blake512.digest('binary');
            ret.set(vp.subarray(0, 32), i * 32);
        }
        const partialBytesNeeded = len - 32 * r;
        let blakeSmall;
        if (partialBytesNeeded === 64) {
            blakeSmall = blake512;
            blakeSmall.init();
        }
        else {
            blakeSmall = yield createBLAKE2b(partialBytesNeeded * 8);
        }
        blakeSmall.update(vp);
        vp = blakeSmall.digest('binary');
        ret.set(vp.subarray(0, partialBytesNeeded), r * 32);
        return ret;
    });
}
function getHashType(type) {
    switch (type) {
        case 'd':
            return 0;
        case 'i':
            return 1;
        default:
            return 2;
    }
}
function argon2Internal(options) {
    return __awaiter(this, void 0, void 0, function* () {
        const { parallelism, iterations, hashLength } = options;
        const password = getUInt8Buffer(options.password);
        const salt = getUInt8Buffer(options.salt);
        const version = 0x13;
        const hashType = getHashType(options.hashType);
        const { memorySize } = options; // in KB
        const [argon2Interface, blake512] = yield Promise.all([
            WASMInterface(wasmJson$i, 1024),
            createBLAKE2b(512),
        ]);
        // last block is for storing the init vector
        argon2Interface.setMemorySize(memorySize * 1024 + 1024);
        const initVector = new Uint8Array(24);
        const initVectorView = new DataView(initVector.buffer);
        initVectorView.setInt32(0, parallelism, true);
        initVectorView.setInt32(4, hashLength, true);
        initVectorView.setInt32(8, memorySize, true);
        initVectorView.setInt32(12, iterations, true);
        initVectorView.setInt32(16, version, true);
        initVectorView.setInt32(20, hashType, true);
        argon2Interface.writeMemory(initVector, memorySize * 1024);
        blake512.init();
        blake512.update(initVector);
        blake512.update(int32LE(password.length));
        blake512.update(password);
        blake512.update(int32LE(salt.length));
        blake512.update(salt);
        blake512.update(int32LE(0)); // key length + key
        blake512.update(int32LE(0)); // associatedData length + associatedData
        const segments = Math.floor(memorySize / (parallelism * 4)); // length of each lane
        const lanes = segments * 4;
        const param = new Uint8Array(72);
        const H0 = blake512.digest('binary');
        param.set(H0);
        for (let lane = 0; lane < parallelism; lane++) {
            param.set(int32LE(0), 64);
            param.set(int32LE(lane), 68);
            let position = lane * lanes;
            let chunk = yield hashFunc(blake512, param, 1024);
            argon2Interface.writeMemory(chunk, position * 1024);
            position += 1;
            param.set(int32LE(1), 64);
            chunk = yield hashFunc(blake512, param, 1024);
            argon2Interface.writeMemory(chunk, position * 1024);
        }
        const C = new Uint8Array(1024);
        writeHexToUInt8(C, argon2Interface.calculate(new Uint8Array([]), memorySize));
        const res = yield hashFunc(blake512, C, hashLength);
        if (options.outputType === 'hex') {
            const digestChars = new Uint8Array(hashLength * 2);
            return getDigestHex(digestChars, res, hashLength);
        }
        if (options.outputType === 'encoded') {
            return encodeResult(salt, options, res);
        }
        // return binary format
        return res;
    });
}
const validateOptions$3 = (options) => {
    if (!options || typeof options !== 'object') {
        throw new Error('Invalid options parameter. It requires an object.');
    }
    if (!options.password) {
        throw new Error('Password must be specified');
    }
    options.password = getUInt8Buffer(options.password);
    if (options.password.length < 1) {
        throw new Error('Password must be specified');
    }
    if (!options.salt) {
        throw new Error('Salt must be specified');
    }
    options.salt = getUInt8Buffer(options.salt);
    if (options.salt.length < 8) {
        throw new Error('Salt should be at least 8 bytes long');
    }
    if (!Number.isInteger(options.iterations) || options.iterations < 1) {
        throw new Error('Iterations should be a positive number');
    }
    if (!Number.isInteger(options.parallelism) || options.parallelism < 1) {
        throw new Error('Parallelism should be a positive number');
    }
    if (!Number.isInteger(options.hashLength) || options.hashLength < 4) {
        throw new Error('Hash length should be at least 4 bytes.');
    }
    if (!Number.isInteger(options.memorySize)) {
        throw new Error('Memory size should be specified.');
    }
    if (options.memorySize < 8 * options.parallelism) {
        throw new Error('Memory size should be at least 8 * parallelism.');
    }
    if (options.outputType === undefined) {
        options.outputType = 'hex';
    }
    if (!['hex', 'binary', 'encoded'].includes(options.outputType)) {
        throw new Error(`Insupported output type ${options.outputType}. Valid values: ['hex', 'binary', 'encoded']`);
    }
};
/**
 * Calculates hash using the argon2i password-hashing function
 * @returns Computed hash
 */
function argon2i(options) {
    return __awaiter(this, void 0, void 0, function* () {
        validateOptions$3(options);
        return argon2Internal(Object.assign(Object.assign({}, options), { hashType: 'i' }));
    });
}
/**
 * Calculates hash using the argon2id password-hashing function
 * @returns Computed hash
 */
function argon2id(options) {
    return __awaiter(this, void 0, void 0, function* () {
        validateOptions$3(options);
        return argon2Internal(Object.assign(Object.assign({}, options), { hashType: 'id' }));
    });
}
/**
 * Calculates hash using the argon2d password-hashing function
 * @returns Computed hash
 */
function argon2d(options) {
    return __awaiter(this, void 0, void 0, function* () {
        validateOptions$3(options);
        return argon2Internal(Object.assign(Object.assign({}, options), { hashType: 'd' }));
    });
}
const getHashParameters = (password, encoded) => {
    const regex = /^\$argon2(id|i|d)\$v=([0-9]+)\$((?:[mtp]=[0-9]+,){2}[mtp]=[0-9]+)\$([A-Za-z0-9+/]+)\$([A-Za-z0-9+/]+)$/;
    const match = encoded.match(regex);
    if (!match) {
        throw new Error('Invalid hash');
    }
    const [, hashType, version, parameters, salt, hash] = match;
    if (version !== '19') {
        throw new Error(`Unsupported version: ${version}`);
    }
    const parsedParameters = {};
    const paramMap = { m: 'memorySize', p: 'parallelism', t: 'iterations' };
    parameters.split(',').forEach((x) => {
        const [n, v] = x.split('=');
        parsedParameters[paramMap[n]] = parseInt(v, 10);
    });
    return Object.assign(Object.assign({}, parsedParameters), { password, hashType: hashType, salt: decodeBase64(salt), hashLength: getDecodeBase64Length(hash), outputType: 'encoded' });
};
const validateVerifyOptions$1 = (options) => {
    if (!options || typeof options !== 'object') {
        throw new Error('Invalid options parameter. It requires an object.');
    }
    if (options.hash === undefined || typeof options.hash !== 'string') {
        throw new Error('Hash should be specified');
    }
};
/**
 * Verifies password using the argon2 password-hashing function
 * @returns True if the encoded hash matches the password
 */
function argon2Verify(options) {
    return __awaiter(this, void 0, void 0, function* () {
        validateVerifyOptions$1(options);
        const params = getHashParameters(options.password, options.hash);
        validateOptions$3(params);
        const hashStart = options.hash.lastIndexOf('$') + 1;
        const result = yield argon2Internal(params);
        return result.substring(hashStart) === options.hash.substring(hashStart);
    });
}

var name$h = "blake2s";
var data$h = "AGFzbQEAAAABEQRgAAF/YAJ/fwBgAX8AYAAAAwkIAAECAwICAAEEBQFwAQEBBQQBAQICBg4CfwFBoIoFC38AQYAICwdwCAZtZW1vcnkCAA5IYXNoX0dldEJ1ZmZlcgAACkhhc2hfRmluYWwAAwlIYXNoX0luaXQABAtIYXNoX1VwZGF0ZQAFDUhhc2hfR2V0U3RhdGUABg5IYXNoX0NhbGN1bGF0ZQAHClNUQVRFX1NJWkUDAQqhMAgFAEGACQvjAgEFfwJAIAFBAUgNAEEAIQICQAJAAkBBwABBACgC8IkBIgNrIgQgAUgNACABIQUMAQtBAEEANgLwiQECQCAERQ0AIANBMGohBSAAIQYDQCAFQYCJAWogBi0AADoAACAGQQFqIQYgBUEBaiIFQfAARw0ACwtBAEEAKAKgiQEiBUHAAGo2AqCJAUEAQQAoAqSJASAFQb9/S2o2AqSJAUGwiQEQAiAAIARqIQACQCABIARrIgVBwQBIDQAgAyABaiEFA0BBAEEAKAKgiQEiBkHAAGo2AqCJAUEAQQAoAqSJASAGQb9/S2o2AqSJASAAEAIgAEHAAGohACAFQUBqIgVBgAFKDQALIAVBQGohBQtBACEGQQAoAvCJASEDIAVFDQELIANBsIkBaiEGA0AgBiACaiAAIAJqLQAAOgAAIAUgAkEBaiICRw0AC0EAKALwiQEhAyAFIQYLQQAgAyAGajYC8IkBCwuXJwoBfgF/An4DfwF+BX8CfgV/AX4Uf0EAQQApA5iJASIBpyICQQApA4iJASIDp2ogACkDECIEpyIFaiIGIARCIIinIgdqIAZBACkDqIkBQquzj/yRo7Pw2wCFIginc0EQdyIGQfLmu+MDaiIJIAJzQRR3IgJqIgogBnNBGHciCyAJaiIMIAJzQRl3Ig1BACkDkIkBIgRCIIinIglBACkDgIkBIg5CIIinaiAAKQMIIg+nIgJqIhAgD0IgiKciBmogEEEAKQOgiQFC/6S5iMWR2oKbf4UiD0IgiKdzQRB3IhFBhd2e23tqIhIgCXNBFHciE2oiFGogACkDKCIVpyIJaiIWIBVCIIinIhBqIBYgBKciFyAOp2ogACkDACIVpyIYaiIZIBVCIIinIhpqIBkgD6dzQRB3IhlB58yn0AZqIhsgF3NBFHciHGoiHSAZc0EYdyIZc0EQdyIeIAFCIIinIh8gA0IgiKdqIAApAxgiAaciFmoiICABQiCIpyIXaiAgIAhCIIinc0EQdyIgQbrqv6p6aiIhIB9zQRR3Ih9qIiIgIHNBGHciICAhaiIhaiIjIA1zQRR3Ig1qIiQgHnNBGHciHiAjaiIjIA1zQRl3IiUgISAfc0EZdyIfIApqIAApAzAiAaciCmoiISABQiCIpyINaiAhIBQgEXNBGHciJnNBEHciISAZIBtqIhRqIhkgH3NBFHciG2oiH2ogACkDICIBQiCIpyIRaiInIAApAzgiCEIgiKciAGogIiAUIBxzQRl3IhxqIAinIhRqIiIgAGogIiALc0EQdyILICYgEmoiEmoiIiAcc0EUdyIcaiImIAtzQRh3IiggJ3NBEHciJyASIBNzQRl3IhIgHWogAaciC2oiEyARaiATICBzQRB3IhMgDGoiDCASc0EUdyISaiIdIBNzQRh3IhMgDGoiDGoiICAlc0EUdyIlaiIpICdzQRh3IicgIGoiICAlc0EZdyIlIAwgEnNBGXciDCAkaiAFaiISIAtqIB8gIXNBGHciHyASc0EQdyISICggImoiIWoiIiAMc0EUdyIMaiIkaiAYaiIoIAJqICggISAcc0EZdyIcIB1qIBRqIh0gCWogHiAdc0EQdyIdIB8gGWoiGWoiHiAcc0EUdyIcaiIfIB1zQRh3Ih1zQRB3IiEgGSAbc0EZdyIZICZqIA1qIhsgFmogEyAbc0EQdyITICNqIhsgGXNBFHciGWoiIyATc0EYdyITIBtqIhtqIiYgJXNBFHciJWoiKCAhc0EYdyIhICZqIiYgJXNBGXciJSAbIBlzQRl3IhkgKWogEGoiGyAXaiAbICQgEnNBGHciEnNBEHciGyAdIB5qIh1qIh4gGXNBFHciGWoiJGogB2oiKSACaiAjIB0gHHNBGXciHGogB2oiHSAGaiAdICdzQRB3Ih0gEiAiaiISaiIiIBxzQRR3IhxqIiMgHXNBGHciHSApc0EQdyInIBIgDHNBGXciDCAfaiAaaiISIApqIBIgE3NBEHciEiAgaiITIAxzQRR3IgxqIh8gEnNBGHciEiATaiITaiIgICVzQRR3IiVqIikgJ3NBGHciJyAgaiIgICVzQRl3IiUgEyAMc0EZdyIMIChqIApqIhMgGGogJCAbc0EYdyIbIBNzQRB3IhMgHSAiaiIdaiIiIAxzQRR3IgxqIiRqIAZqIiggFmogKCAdIBxzQRl3IhwgH2ogEGoiHSALaiAhIB1zQRB3Ih0gGyAeaiIbaiIeIBxzQRR3IhxqIh8gHXNBGHciHXNBEHciISAbIBlzQRl3IhkgI2ogAGoiGyANaiASIBtzQRB3IhIgJmoiGyAZc0EUdyIZaiIjIBJzQRh3IhIgG2oiG2oiJiAlc0EUdyIlaiIoICFzQRh3IiEgJmoiJiAlc0EZdyIlIBsgGXNBGXciGSApaiAXaiIbIBpqIBsgJCATc0EYdyITc0EQdyIbIB0gHmoiHWoiHiAZc0EUdyIZaiIkaiANaiIpIApqICMgHSAcc0EZdyIcaiARaiIdIAVqIB0gJ3NBEHciHSATICJqIhNqIiIgHHNBFHciHGoiIyAdc0EYdyIdIClzQRB3IicgEyAMc0EZdyIMIB9qIAlqIhMgFGogEyASc0EQdyISICBqIhMgDHNBFHciDGoiHyASc0EYdyISIBNqIhNqIiAgJXNBFHciJWoiKSAnc0EYdyInICBqIiAgJXNBGXciJSATIAxzQRl3IgwgKGogBmoiEyAaaiAkIBtzQRh3IhsgE3NBEHciEyAdICJqIh1qIiIgDHNBFHciDGoiJGogB2oiKCAJaiAoIB0gHHNBGXciHCAfaiAXaiIdIBFqICEgHXNBEHciHSAbIB5qIhtqIh4gHHNBFHciHGoiHyAdc0EYdyIdc0EQdyIhIBsgGXNBGXciGSAjaiAQaiIbIBRqIBIgG3NBEHciEiAmaiIbIBlzQRR3IhlqIiMgEnNBGHciEiAbaiIbaiImICVzQRR3IiVqIiggIXNBGHciISAmaiImICVzQRl3IiUgGyAZc0EZdyIZIClqIAVqIhsgGGogGyAkIBNzQRh3IhNzQRB3IhsgHSAeaiIdaiIeIBlzQRR3IhlqIiRqIAJqIikgBWogIyAdIBxzQRl3IhxqIABqIh0gC2ogHSAnc0EQdyIdIBMgImoiE2oiIiAcc0EUdyIcaiIjIB1zQRh3Ih0gKXNBEHciJyATIAxzQRl3IgwgH2ogAmoiEyAWaiATIBJzQRB3IhIgIGoiEyAMc0EUdyIMaiIfIBJzQRh3IhIgE2oiE2oiICAlc0EUdyIlaiIpICdzQRh3IicgIGoiICAlc0EZdyIlIBMgDHNBGXciDCAoaiAHaiITIBdqICQgG3NBGHciGyATc0EQdyITIB0gImoiHWoiIiAMc0EUdyIMaiIkaiAQaiIoIApqICggHSAcc0EZdyIcIB9qIBFqIh0gGGogISAdc0EQdyIdIBsgHmoiG2oiHiAcc0EUdyIcaiIfIB1zQRh3Ih1zQRB3IiEgGyAZc0EZdyIZICNqIAlqIhsgAGogEiAbc0EQdyISICZqIhsgGXNBFHciGWoiIyASc0EYdyISIBtqIhtqIiYgJXNBFHciJWoiKCAhc0EYdyIhICZqIiYgJXNBGXciJSAbIBlzQRl3IhkgKWogFmoiGyALaiAbICQgE3NBGHciE3NBEHciGyAdIB5qIh1qIh4gGXNBFHciGWoiJGogGGoiKSAQaiAjIB0gHHNBGXciHGogBmoiHSANaiAdICdzQRB3Ih0gEyAiaiITaiIiIBxzQRR3IhxqIiMgHXNBGHciHSApc0EQdyInIBMgDHNBGXciDCAfaiAUaiITIBpqIBMgEnNBEHciEiAgaiITIAxzQRR3IgxqIh8gEnNBGHciEiATaiITaiIgICVzQRR3IiVqIikgJ3NBGHciJyAgaiIgICVzQRl3IiUgEyAMc0EZdyIMIChqIBZqIhMgCWogJCAbc0EYdyIbIBNzQRB3IhMgHSAiaiIdaiIiIAxzQRR3IgxqIiRqIBdqIiggB2ogKCAdIBxzQRl3IhwgH2ogAmoiHSAKaiAhIB1zQRB3Ih0gGyAeaiIbaiIeIBxzQRR3IhxqIh8gHXNBGHciHXNBEHciISAbIBlzQRl3IhkgI2ogC2oiGyAGaiASIBtzQRB3IhIgJmoiGyAZc0EUdyIZaiIjIBJzQRh3IhIgG2oiG2oiJiAlc0EUdyIlaiIoICFzQRh3IiEgJmoiJiAlc0EZdyIlIBsgGXNBGXciGSApaiAAaiIbIBRqIBsgJCATc0EYdyITc0EQdyIbIB0gHmoiHWoiHiAZc0EUdyIZaiIkaiAUaiIpIA1qICMgHSAcc0EZdyIcaiAaaiIdIBFqIB0gJ3NBEHciHSATICJqIhNqIiIgHHNBFHciHGoiIyAdc0EYdyIdIClzQRB3IicgEyAMc0EZdyIMIB9qIAVqIhMgDWogEyASc0EQdyISICBqIhMgDHNBFHciDGoiHyASc0EYdyISIBNqIhNqIiAgJXNBFHciJWoiKSAnc0EYdyInICBqIiAgJXNBGXciJSATIAxzQRl3IgwgKGogGmoiEyAAaiAkIBtzQRh3IhsgE3NBEHciEyAdICJqIh1qIiIgDHNBFHciDGoiJGogFmoiKCAGaiAoIB0gHHNBGXciHCAfaiAKaiIdIAdqICEgHXNBEHciHSAbIB5qIhtqIh4gHHNBFHciHGoiHyAdc0EYdyIdc0EQdyIhIBsgGXNBGXciGSAjaiAFaiIbIAlqIBIgG3NBEHciEiAmaiIbIBlzQRR3IhlqIiMgEnNBGHciEiAbaiIbaiImICVzQRR3IiVqIiggIXNBGHciISAmaiImICVzQRl3IiUgGyAZc0EZdyIZIClqIBFqIhsgAmogGyAkIBNzQRh3IhNzQRB3IhsgHSAeaiIdaiIeIBlzQRR3IhlqIiRqIApqIikgGmogIyAdIBxzQRl3IhxqIAtqIh0gEGogHSAnc0EQdyIdIBMgImoiE2oiIiAcc0EUdyIcaiIjIB1zQRh3Ih0gKXNBEHciJyATIAxzQRl3IgwgH2ogGGoiEyAXaiATIBJzQRB3IhIgIGoiEyAMc0EUdyIMaiIfIBJzQRh3IhIgE2oiE2oiICAlc0EUdyIlaiIpICdzQRh3IicgIGoiICAlc0EZdyIlIBMgDHNBGXciDCAoaiAXaiITIBRqICQgG3NBGHciGyATc0EQdyITIB0gImoiHWoiIiAMc0EUdyIMaiIkaiAAaiIoIAVqICggHSAcc0EZdyIcIB9qIA1qIh0gEGogISAdc0EQdyIdIBsgHmoiG2oiHiAcc0EUdyIcaiIfIB1zQRh3Ih1zQRB3IiEgGyAZc0EZdyIZICNqIAZqIhsgEWogEiAbc0EQdyISICZqIhsgGXNBFHciGWoiIyASc0EYdyISIBtqIhtqIiYgJXNBFHciJWoiKCAhc0EYdyIhICZqIiYgJXNBGXciJSAbIBlzQRl3IhkgKWogC2oiGyAWaiAbICQgE3NBGHciE3NBEHciGyAdIB5qIh1qIh4gGXNBFHciGWoiJGogEGoiKSAGaiAjIB0gHHNBGXciHGogAmoiHSAJaiAdICdzQRB3Ih0gEyAiaiITaiIiIBxzQRR3IhxqIiMgHXNBGHciHSApc0EQdyInIBMgDHNBGXciDCAfaiAHaiITIBhqIBMgEnNBEHciEiAgaiITIAxzQRR3IgxqIh8gEnNBGHciEiATaiITaiIgICVzQRR3IiVqIikgJ3NBGHciJyAgaiIgICVzQRl3IiUgEyAMc0EZdyIMIChqIBRqIhMgEWogJCAbc0EYdyIbIBNzQRB3IhMgHSAiaiIdaiIiIAxzQRR3IgxqIiRqIA1qIiggF2ogKCAdIBxzQRl3IhwgH2ogFmoiHSAAaiAhIB1zQRB3Ih0gGyAeaiIbaiIeIBxzQRR3IhxqIh8gHXNBGHciHXNBEHciISAbIBlzQRl3IhkgI2ogGGoiGyALaiASIBtzQRB3IhIgJmoiGyAZc0EUdyIZaiIjIBJzQRh3IhIgG2oiG2oiJiAlc0EUdyIlaiIoICFzQRh3IiEgJmoiJiAlc0EZdyIlIBsgGXNBGXciGSApaiAaaiIbIAVqIBsgJCATc0EYdyITc0EQdyIbIB0gHmoiHWoiHiAZc0EUdyIZaiIkaiAXaiIXIBZqICMgHSAcc0EZdyIWaiAJaiIcIAdqIBwgJ3NBEHciHCATICJqIhNqIh0gFnNBFHciFmoiIiAcc0EYdyIcIBdzQRB3IhcgEyAMc0EZdyIMIB9qIApqIhMgAmogEyASc0EQdyISICBqIhMgDHNBFHciDGoiHyASc0EYdyISIBNqIhNqIiAgJXNBFHciI2oiJSAXc0EYdyIXICBqIiAgI3NBGXciIyATIAxzQRl3IgwgKGogC2oiCyAFaiAkIBtzQRh3IgUgC3NBEHciCyAcIB1qIhNqIhsgDHNBFHciDGoiHGogEWoiESAUaiARIBMgFnNBGXciFiAfaiAJaiIJIAJqICEgCXNBEHciAiAFIB5qIgVqIgkgFnNBFHciFmoiFCACc0EYdyICc0EQdyIRIAUgGXNBGXciBSAiaiAaaiIaIAdqIBIgGnNBEHciByAmaiIaIAVzQRR3IgVqIhIgB3NBGHciByAaaiIaaiITICNzQRR3IhlqIh2tQiCGIBwgC3NBGHciCyAbaiIbIAxzQRl3IgwgFGogAGoiACAQaiAAIAdzQRB3IgcgIGoiECAMc0EUdyIAaiIUrYQgDoUgEiACIAlqIgIgFnNBGXciCWogDWoiFiAYaiAWIBdzQRB3IhggG2oiFiAJc0EUdyIJaiIXIBhzQRh3IhggFmoiFq1CIIYgGiAFc0EZdyIFICVqIAZqIgYgCmogBiALc0EQdyIGIAJqIgIgBXNBFHciBWoiGiAGc0EYdyIGIAJqIgKthIU3A4CJAUEAIAMgF61CIIYgGq2EhSAdIBFzQRh3IhogE2oiF61CIIYgFCAHc0EYdyIHIBBqIhCthIU3A4iJAUEAIAQgECAAc0EZd61CIIYgFiAJc0EZd62EhSAGrUIghiAarYSFNwOQiQFBACACIAVzQRl3rUIghiAXIBlzQRl3rYRBACkDmIkBhSAHrUIghiAYrYSFNwOYiQEL1wIBBH8jAEEgayIAJAAgAEEYakIANwMAIABBEGpCADcDACAAQgA3AwggAEIANwMAAkBBACgCqIkBDQBBAEEAKAKgiQEiAUEAKALwiQEiAmoiAzYCoIkBQQBBACgCpIkBIAMgAUlqNgKkiQECQEEALQD4iQFFDQBBAEF/NgKsiQELQQBBfzYCqIkBAkAgAkE/Sg0AQQAhAQNAIAIgAWpBsIkBakEAOgAAIAFBAWoiAUHAAEEAKALwiQEiAmtIDQALC0GwiQEQAiAAQQAoAoCJASIBNgIAIABBACgChIkBNgIEIABBACkDiIkBNwMIIABBACkDkIkBNwMQIABBACkDmIkBNwMYQQAoAvSJASIDQQBMDQBBACABOgCACSADQQFGDQBBASEBQQEhAgNAIAFBgAlqIAAgAWotAAA6AAAgAyACQQFqIgJB/wFxIgFKDQALCyAAQSBqJAALoAMBBH8jAEHAAGsiASQAQQBBgQI7AYKKAUEAIABBEHYiAjoAgYoBQQAgAEEDdjoAgIoBQYR/IQADQCAAQfyJAWpBADoAACAAQQFqIgMgAE8hBCADIQAgBA0AC0EAIQBBAEEAKAKAigEiA0HnzKfQBnM2AoCJAUEAQQAoAoSKAUGF3Z7be3M2AoSJAUEAQQAoAoiKAUHy5rvjA3M2AoiJAUEAQQAoAoyKAUG66r+qenM2AoyJAUEAQQAoApCKAUH/pLmIBXM2ApCJAUEAQQAoApSKAUGM0ZXYeXM2ApSJAUEAQQAoApiKAUGrs4/8AXM2ApiJAUEAIANB/wFxNgL0iQFBAEEAKAKcigFBmZqD3wVzNgKciQECQCACRQ0AIAFBOGpCADcDACABQTBqQgA3AwAgAUEoakIANwMAIAFBIGpCADcDACABQRhqQgA3AwAgAUEQakIANwMAIAFCADcDCCABQgA3AwBBACEDA0AgASAAaiAAQYAJai0AADoAACACIANBAWoiA0H/AXEiAEsNAAsgAUHAABABCyABQcAAaiQACwkAQYAJIAAQAQsGAEGAiQELDwAgARAEQYAJIAAQARADCwsLAQBBgAgLBHwAAAA=";
var hash$h = "0f570f49";
var wasmJson$h = {
	name: name$h,
	data: data$h,
	hash: hash$h
};

const mutex$j = new Mutex();
let wasmCache$j = null;
function validateBits$3(bits) {
    if (!Number.isInteger(bits) || bits < 8 || bits > 256 || bits % 8 !== 0) {
        return new Error('Invalid variant! Valid values: 8, 16, ..., 256');
    }
    return null;
}
function getInitParam(outputBits, keyBits) {
    // eslint-disable-next-line no-bitwise
    return outputBits | (keyBits << 16);
}
/**
 * Calculates BLAKE2s hash
 * @param data Input data (string, Buffer or TypedArray)
 * @param bits Number of output bits, which has to be a number
 *             divisible by 8, between 8 and 256. Defaults to 256.
 * @param key Optional key (string, Buffer or TypedArray). Maximum length is 32 bytes.
 * @returns Computed hash as a hexadecimal string
 */
function blake2s(data, bits = 256, key = null) {
    if (validateBits$3(bits)) {
        return Promise.reject(validateBits$3(bits));
    }
    let keyBuffer = null;
    let initParam = bits;
    if (key !== null) {
        keyBuffer = getUInt8Buffer(key);
        if (keyBuffer.length > 32) {
            return Promise.reject(new Error('Max key length is 32 bytes'));
        }
        initParam = getInitParam(bits, keyBuffer.length);
    }
    const hashLength = bits / 8;
    if (wasmCache$j === null || wasmCache$j.hashLength !== hashLength) {
        return lockedCreate(mutex$j, wasmJson$h, hashLength)
            .then((wasm) => {
            wasmCache$j = wasm;
            if (initParam > 512) {
                wasmCache$j.writeMemory(keyBuffer);
            }
            return wasmCache$j.calculate(data, initParam);
        });
    }
    try {
        if (initParam > 512) {
            wasmCache$j.writeMemory(keyBuffer);
        }
        const hash = wasmCache$j.calculate(data, initParam);
        return Promise.resolve(hash);
    }
    catch (err) {
        return Promise.reject(err);
    }
}
/**
 * Creates a new BLAKE2s hash instance
 * @param bits Number of output bits, which has to be a number
 *             divisible by 8, between 8 and 256. Defaults to 256.
 * @param key Optional key (string, Buffer or TypedArray). Maximum length is 32 bytes.
 */
function createBLAKE2s(bits = 256, key = null) {
    if (validateBits$3(bits)) {
        return Promise.reject(validateBits$3(bits));
    }
    let keyBuffer = null;
    let initParam = bits;
    if (key !== null) {
        keyBuffer = getUInt8Buffer(key);
        if (keyBuffer.length > 32) {
            return Promise.reject(new Error('Max key length is 32 bytes'));
        }
        initParam = getInitParam(bits, keyBuffer.length);
    }
    const outputSize = bits / 8;
    return WASMInterface(wasmJson$h, outputSize).then((wasm) => {
        if (initParam > 512) {
            wasm.writeMemory(keyBuffer);
        }
        wasm.init(initParam);
        const obj = {
            init: initParam > 512
                ? () => {
                    wasm.writeMemory(keyBuffer);
                    wasm.init(initParam);
                    return obj;
                }
                : () => {
                    wasm.init(initParam);
                    return obj;
                },
            update: (data) => { wasm.update(data); return obj; },
            digest: (outputType) => wasm.digest(outputType),
            save: () => wasm.save(),
            load: (data) => { wasm.load(data); return obj; },
            blockSize: 64,
            digestSize: outputSize,
        };
        return obj;
    });
}

var name$g = "blake3";
var data$g = "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FWogFCAfc0EZdyIVaiIUIBhqIB0gFHNBEHciFCAlaiIYIBVzQRR3IhVqIhkgFHNBGHciFCAYaiIYaiIdICBzQRR3Ih9qIiA2AgAgACAXICQgHHNBGHciHCAeaiIeIBtzQRl3IhtqIAFqIgEgFmogASAUc0EQdyIBICtqIhQgG3NBFHciFmoiFyABc0EYdyIBNgI4IAAgGCAVc0EZdyIVIC5qIANqIgMgE2ogAyAcc0EQdyIDIAIgImoiAmoiIiAVc0EUdyIVaiITNgIEIAAgASAUaiIBNgIkIAAgAiAFc0EZdyICIBlqICFqIgUgGmogBSAnc0EQdyIFIB5qIhQgAnNBFHciAmoiGjYCCCAAICAgEnNBGHciEiAdaiIhNgIoIAAgEyADc0EYdyIDNgIwIAAgASAWc0EZdzYCECAAIBogBXNBGHciATYCNCAAICEgH3NBGXc2AhQgACABIBRqIgE2AiAgACADICJqIgUgFXNBGXc2AhggACASNgI8IAAgASACc0EZdzYCHCAAIBc2AgwgACAFNgIsC7cDAwR/A34FfyMAQdABayIBJAACQCAAe6ciAkEALQCQigEiA08NACABQShqIQQDQCABQQApA4CJASIANwMAIAFBACkDiIkBIgU3AwggAUEAKQOQiQEiBjcDECABQQApA5iJASIHNwMYIAEgA0EFdCIDQdGJAWoiCCkDADcDKCABIANB2YkBaiIJKQMANwMwIAEgA0HhiQFqIgopAwA3AzggASADQemJAWoiCykDADcDQEEALQCKigEhDCABQcAAOgBoIAEgDEEEciIMOgBpIAFCADcDICABIANB8YkBaikDADcDSCABIANB+YkBaikDADcDUCABIANBgYoBaikDADcDWCABIANBiYoBaikDADcDYCABIAc3A4gBIAEgBjcDgAEgASAFNwN4IAEgADcDcCABQZABaiABQfAAaiAEQcAAQgAgDBADIAsgASkDyAEgASkDqAGFNwMAIAogASkDwAEgASkDoAGFNwMAIAkgASkDuAEgASkDmAGFNwMAIAggASkDsAEgASkDkAGFNwMAQQBBAC0AkIoBQX9qIgM6AJCKASACIANB/wFxIgNJDQALCyABQdABaiQAC/oLBAR/BH4GfwF+IwBB0AJrIgUkAAJAAkAgAUGACEsNAEEAIQYgASEHQQAhCAJAIAFB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IQwDQCABQbABaiABIAsgCUH/AXEgCCACQQhyQf8BcRADIAEgASkD2AEiDSABKQO4AYU3A3ggASABKQPgASIOIAEpA8ABhTcDgAEgASAGIAEpA+gBIg+FNwOoASABIAUgDoU3A6ABIAEgBCANhTcDmAEgASADIAEpA9ABIg2FNwOQASABIA8gASkDyAGFNwOIASAAQcAAIABBwABJGyIQQX9qIQkgASANIAEpA7ABhSINNwNwIA2nIREgCiEHIAwhAgJAA0AgAiAROgAAIAlFDQEgCUF/aiEJIAJBAWohAiAHLQAAIREgB0EBaiEHDAALCyAAIBBrIgBFDQIgDCAQaiEMIAhCAXwhCCABKQMIIQQgASkDACEDIAEpAxghBiABKQMQIQUgAS0AaSECIAEtAGghCQwACwsCQAJAAkBBAC0AiYoBIglBBnRBAEEALQCIigEiDGtGDQAgAUHgAGpBACkDgIoBNwMAIAFB2ABqQQApA/iJATcDACABQdAAakEAKQPwiQE3AwAgAUHIAGpBACkD6IkBNwMAIAFBwABqQQApA+CJATcDACABQThqQQApA9iJATcDACABQTBqQQApA9CJATcDACABQQApA8iJATcDKCABQQApA8CJASIINwMgIAFBACkDuIkBIg03AxggAUEAKQOwiQEiDjcDECABQQApA6iJASIPNwMIIAFBACkDoIkBIgM3AwBBAC0AiooBIQcgAUHuAGogAUG0AWovAQA7AQAgASABKAGwATYBaiABIAw6AGggASAHIAlFckECciIJOgBpDAELIAFB4ABqIAJBfmoiAkEFdCIJQcmKAWopAwA3AwAgAUHYAGogCUHBigFqKQMANwMAIAFB0ABqIAlBuYoBaikDADcDACABQcgAaiAJQbGKAWopAwA3AwBBwAAhDCABQcAAaiAJQamKAWopAwA3AwAgAUE4aiAJQaGKAWopAwA3AwAgAUEwaiAJQZmKAWopAwA3AwBCACEIIAFCADcDICABQQApA5iJASINNwMYIAFBACkDkIkBIg43AxAgAUEAKQOIiQEiDzcDCCABQQApA4CJASIDNwMAIAEgCUGRigFqKQMANwMoQQAtAIqKASEJIAFB7gBqIAFBsAFqQQRqLwEAOwEAIAEgASgBsAE2AWogASAJQQRyIgk6AGkgAUHAADoAaCACRQ0BCyACQX9qIgdBBXQiEUGRigFqKQMAIQQgEUGZigFqKQMAIQUgEUGhigFqKQMAIQYgEUGpigFqKQMAIRIgASANNwOIASABIA43A4ABIAEgDzcDeCABIAM3A3AgAUGwAWogAUHwAGogAUEoaiIQIAwgCCAJQf8BcRADIAFBwAA6AGggASASNwNAIAEgBjcDOCABIAU3AzAgASAENwMoIAFCADcDICABQQApA5iJASIINwMYIAFBACkDkIkBIg03AxAgAUEAKQOIiQEiDjcDCCABQQApA4CJASIPNwMAIAFBAC0AiooBQQRyIgk6AGkgASABKQPoASABKQPIAYU3A2AgASABKQPgASABKQPAAYU3A1ggASABKQPYASABKQO4AYU3A1AgASABKQPQASABKQOwAYU3A0ggAUHuAGogAUGwAWpBBGoiDC8BADsBACABIAEoAbABNgFqIAdFDQAgAUHqAGohESACQQV0QemJAWohAgNAIAJBaGopAwAhAyACQXBqKQMAIQQgAkF4aikDACEFIAIpAwAhBiABIAg3A4gBIAEgDTcDgAEgASAONwN4IAEgDzcDcCABQbABaiABQfAAaiAQQcAAQgAgCUH/AXEQAyABQcAAOgBoIAEgBjcDQCABIAU3AzggASAENwMwIAEgAzcDKCABQgA3AyAgAUEAKQOYiQEiCDcDGCABQQApA5CJASINNwMQIAFBACkDiIkBIg43AwggAUEAKQOAiQEiDzcDACABQQAtAIqKAUEEciIJOgBpIAEgASkD6AEgASkDyAGFNwNgIAEgASkD4AEgASkDwAGFNwNYIAEgASkD2AEgASkDuAGFNwNQIAEgASkD0AEgASkDsAGFNwNIIBFBBGogDC8BADsBACARIAEoAbABNgEAIAJBYGohAiAHQX9qIgcNAAsLIAFB8ABqQQFyIQogAUEoaiELQgAhCEGACSEMQcAAIQIDQCABQbABaiABIAsgAkH/AXEgCCAJQQhyQf8BcRADIAEgASkD2AEiDSABKQO4AYU3A3ggASABKQPgASIOIAEpA8ABhTcDgAEgASABKQPoASIPIAEpA8gBhTcDiAEgASABKQMAIAEpA9ABIgOFNwOQASABIA0gASkDCIU3A5gBIAEgDiABKQMQhTcDoAEgASADIAEpA7ABhSINNwNwIAEgDyABKQMYhTcDqAEgAEHAACAAQcAASRsiEEF/aiECIA2nIREgCiEHIAwhCQJAA0AgCSAROgAAIAJFDQEgAkF/aiECIAlBAWohCSAHLQAAIREgB0EBaiEHDAALCyAAIBBrIgBFDQEgDCAQaiEMIAhCAXwhCCABLQBpIQkgAS0AaCECDAALCyABQfABaiQAC6MCAQR+AkACQCAAQSBGDQBCq7OP/JGjs/DbACEBQv+kuYjFkdqCm38hAkLy5rvjo6f9p6V/IQNC58yn0NbQ67O7fyEEQQAhAAwBC0EAKQOYCSEBQQApA5AJIQJBACkDiAkhA0EAKQOACSEEQRAhAAtBACAAOgCKigFBAEIANwOAigFBAEIANwP4iQFBAEIANwPwiQFBAEIANwPoiQFBAEIANwPgiQFBAEIANwPYiQFBAEIANwPQiQFBAEIANwPIiQFBAEIANwPAiQFBACABNwO4iQFBACACNwOwiQFBACADNwOoiQFBACAENwOgiQFBACABNwOYiQFBACACNwOQiQFBACADNwOIiQFBACAENwOAiQFBAEEAOgCQigFBAEEAOwGIigELBgAgABABCwYAIAAQBgsGAEGAiQELqwIBBH4CQAJAIAFBIEYNAEKrs4/8kaOz8NsAIQNC/6S5iMWR2oKbfyEEQvLmu+Ojp/2npX8hBULnzKfQ1tDrs7t/IQZBACEBDAELQQApA5gJIQNBACkDkAkhBEEAKQOICSEFQQApA4AJIQZBECEBC0EAIAE6AIqKAUEAQgA3A4CKAUEAQgA3A/iJAUEAQgA3A/CJAUEAQgA3A+iJAUEAQgA3A+CJAUEAQgA3A9iJAUEAQgA3A9CJAUEAQgA3A8iJAUEAQgA3A8CJAUEAIAM3A7iJAUEAIAQ3A7CJAUEAIAU3A6iJAUEAIAY3A6CJAUEAIAM3A5iJAUEAIAQ3A5CJAUEAIAU3A4iJAUEAIAY3A4CJAUEAQQA6AJCKAUEAQQA7AYiKASAAEAEgAhAGCwsLAQBBgAgLBHgHAAA=";
var hash$g = "e8655383";
var wasmJson$g = {
	name: name$g,
	data: data$g,
	hash: hash$g
};

const mutex$i = new Mutex();
let wasmCache$i = null;
function validateBits$2(bits) {
    if (!Number.isInteger(bits) || bits < 8 || bits % 8 !== 0) {
        return new Error('Invalid variant! Valid values: 8, 16, ...');
    }
    return null;
}
/**
 * Calculates BLAKE3 hash
 * @param data Input data (string, Buffer or TypedArray)
 * @param bits Number of output bits, which has to be a number
 *             divisible by 8. Defaults to 256.
 * @param key Optional key (string, Buffer or TypedArray). Length should be 32 bytes.
 * @returns Computed hash as a hexadecimal string
 */
function blake3(data, bits = 256, key = null) {
    if (validateBits$2(bits)) {
        return Promise.reject(validateBits$2(bits));
    }
    let keyBuffer = null;
    let initParam = 0; // key is empty by default
    if (key !== null) {
        keyBuffer = getUInt8Buffer(key);
        if (keyBuffer.length !== 32) {
            return Promise.reject(new Error('Key length must be exactly 32 bytes'));
        }
        initParam = 32;
    }
    const hashLength = bits / 8;
    const digestParam = hashLength;
    if (wasmCache$i === null || wasmCache$i.hashLength !== hashLength) {
        return lockedCreate(mutex$i, wasmJson$g, hashLength)
            .then((wasm) => {
            wasmCache$i = wasm;
            if (initParam === 32) {
                wasmCache$i.writeMemory(keyBuffer);
            }
            return wasmCache$i.calculate(data, initParam, digestParam);
        });
    }
    try {
        if (initParam === 32) {
            wasmCache$i.writeMemory(keyBuffer);
        }
        const hash = wasmCache$i.calculate(data, initParam, digestParam);
        return Promise.resolve(hash);
    }
    catch (err) {
        return Promise.reject(err);
    }
}
/**
 * Creates a new BLAKE3 hash instance
 * @param bits Number of output bits, which has to be a number
 *             divisible by 8. Defaults to 256.
 * @param key Optional key (string, Buffer or TypedArray). Length should be 32 bytes.
 */
function createBLAKE3(bits = 256, key = null) {
    if (validateBits$2(bits)) {
        return Promise.reject(validateBits$2(bits));
    }
    let keyBuffer = null;
    let initParam = 0; // key is empty by default
    if (key !== null) {
        keyBuffer = getUInt8Buffer(key);
        if (keyBuffer.length !== 32) {
            return Promise.reject(new Error('Key length must be exactly 32 bytes'));
        }
        initParam = 32;
    }
    const outputSize = bits / 8;
    const digestParam = outputSize;
    return WASMInterface(wasmJson$g, outputSize).then((wasm) => {
        if (initParam === 32) {
            wasm.writeMemory(keyBuffer);
        }
        wasm.init(initParam);
        const obj = {
            init: initParam === 32
                ? () => {
                    wasm.writeMemory(keyBuffer);
                    wasm.init(initParam);
                    return obj;
                }
                : () => {
                    wasm.init(initParam);
                    return obj;
                },
            update: (data) => { wasm.update(data); return obj; },
            digest: (outputType) => wasm.digest(outputType, digestParam),
            save: () => wasm.save(),
            load: (data) => { wasm.load(data); return obj; },
            blockSize: 64,
            digestSize: outputSize,
        };
        return obj;
    });
}

var name$f = "crc32";
var data$f = "AGFzbQEAAAABEQRgAAF/YAF/AGAAAGACf38AAwgHAAEBAQIAAwQFAXABAQEFBAEBAgIGDgJ/AUGQyQULfwBBgAgLB3AIBm1lbW9yeQIADkhhc2hfR2V0QnVmZmVyAAAJSGFzaF9Jbml0AAILSGFzaF9VcGRhdGUAAwpIYXNoX0ZpbmFsAAQNSGFzaF9HZXRTdGF0ZQAFDkhhc2hfQ2FsY3VsYXRlAAYKU1RBVEVfU0laRQMBCq0HBwUAQYAJC8MDAQN/QYCJASEBQQAhAgNAIAFBAEEAQQBBAEEAQQBBAEEAIAJBAXFrIABxIAJBAXZzIgNBAXFrIABxIANBAXZzIgNBAXFrIABxIANBAXZzIgNBAXFrIABxIANBAXZzIgNBAXFrIABxIANBAXZzIgNBAXFrIABxIANBAXZzIgNBAXFrIABxIANBAXZzIgNBAXFrIABxIANBAXZzNgIAIAFBBGohASACQQFqIgJBgAJHDQALQQAhAANAIABBhJEBaiAAQYSJAWooAgAiAkH/AXFBAnRBgIkBaigCACACQQh2cyICNgIAIABBhJkBaiACQf8BcUECdEGAiQFqKAIAIAJBCHZzIgI2AgAgAEGEoQFqIAJB/wFxQQJ0QYCJAWooAgAgAkEIdnMiAjYCACAAQYSpAWogAkH/AXFBAnRBgIkBaigCACACQQh2cyICNgIAIABBhLEBaiACQf8BcUECdEGAiQFqKAIAIAJBCHZzIgI2AgAgAEGEuQFqIAJB/wFxQQJ0QYCJAWooAgAgAkEIdnMiAjYCACAAQYTBAWogAkH/AXFBAnRBgIkBaigCACACQQh2czYCACAAQQRqIgBB/AdHDQALCycAAkBBACgCgMkBIABGDQAgABABQQAgADYCgMkBC0EAQQA2AoTJAQuhAgEDf0EAKAKEyQFBf3MhAUGACSECAkAgAEEISQ0AQYAJIQIDQCACQQRqKAIAIgNBDnZB/AdxQYCRAWooAgAgA0EWdkH8B3FBgIkBaigCAHMgA0EGdkH8B3FBgJkBaigCAHMgA0H/AXFBAnRBgKEBaigCAHMgAigCACABcyIBQRZ2QfwHcUGAqQFqKAIAcyABQQ52QfwHcUGAsQFqKAIAcyABQQZ2QfwHcUGAuQFqKAIAcyABQf8BcUECdEGAwQFqKAIAcyEBIAJBCGohAiAAQXhqIgBBB0sNAAsLAkAgAEUNAANAIAFB/wFxIAItAABzQQJ0QYCJAWooAgAgAUEIdnMhASACQQFqIQIgAEF/aiIADQALC0EAIAFBf3M2AoTJAQszAQF/QQBBACgChMkBIgBBGHQgAEEIdEGAgPwHcXIgAEEIdkGA/gNxIABBGHZycjYCgAkLBgBBhMkBC1oAAkBBACgCgMkBIAFGDQAgARABQQAgATYCgMkBC0EAQQA2AoTJASAAEANBAEEAKAKEyQEiAUEYdCABQQh0QYCA/AdxciABQQh2QYD+A3EgAUEYdnJyNgKACQsLCwEAQYAICwQEAAAA";
var hash$f = "749723dc";
var wasmJson$f = {
	name: name$f,
	data: data$f,
	hash: hash$f
};

const mutex$h = new Mutex();
let wasmCache$h = null;
/**
 * Calculates CRC-32 hash
 * @param data Input data (string, Buffer or TypedArray)
 * @returns Computed hash as a hexadecimal string
 */
function crc32(data) {
    if (wasmCache$h === null) {
        return lockedCreate(mutex$h, wasmJson$f, 4)
            .then((wasm) => {
            wasmCache$h = wasm;
            return wasmCache$h.calculate(data, 0xEDB88320);
        });
    }
    try {
        const hash = wasmCache$h.calculate(data, 0xEDB88320);
        return Promise.resolve(hash);
    }
    catch (err) {
        return Promise.reject(err);
    }
}
/**
 * Creates a new CRC-32 hash instance
 */
function createCRC32() {
    return WASMInterface(wasmJson$f, 4).then((wasm) => {
        wasm.init(0xEDB88320);
        const obj = {
            init: () => { wasm.init(0xEDB88320); return obj; },
            update: (data) => { wasm.update(data); return obj; },
            digest: (outputType) => wasm.digest(outputType),
            save: () => wasm.save(),
            load: (data) => { wasm.load(data); return obj; },
            blockSize: 4,
            digestSize: 4,
        };
        return obj;
    });
}

const mutex$g = new Mutex();
let wasmCache$g = null;
/**
 * Calculates CRC-32C hash
 * @param data Input data (string, Buffer or TypedArray)
 * @returns Computed hash as a hexadecimal string
 */
function crc32c(data) {
    if (wasmCache$g === null) {
        return lockedCreate(mutex$g, wasmJson$f, 4)
            .then((wasm) => {
            wasmCache$g = wasm;
            return wasmCache$g.calculate(data, 0x82F63B78);
        });
    }
    try {
        const hash = wasmCache$g.calculate(data, 0x82F63B78);
        return Promise.resolve(hash);
    }
    catch (err) {
        return Promise.reject(err);
    }
}
/**
 * Creates a new CRC-32C hash instance
 */
function createCRC32C() {
    return WASMInterface(wasmJson$f, 4).then((wasm) => {
        wasm.init(0x82F63B78);
        const obj = {
            init: () => { wasm.init(0x82F63B78); return obj; },
            update: (data) => { wasm.update(data); return obj; },
            digest: (outputType) => wasm.digest(outputType),
            save: () => wasm.save(),
            load: (data) => { wasm.load(data); return obj; },
            blockSize: 4,
            digestSize: 4,
        };
        return obj;
    });
}

var name$e = "md4";
var data$e = "AGFzbQEAAAABEgRgAAF/YAAAYAF/AGACf38BfwMIBwABAgMBAAIEBQFwAQEBBQQBAQICBg4CfwFBoIoFC38AQYAICwdwCAZtZW1vcnkCAA5IYXNoX0dldEJ1ZmZlcgAACUhhc2hfSW5pdAABC0hhc2hfVXBkYXRlAAIKSGFzaF9GaW5hbAAEDUhhc2hfR2V0U3RhdGUABQ5IYXNoX0NhbGN1bGF0ZQAGClNUQVRFX1NJWkUDAQqXEQcFAEGACQstAEEAQv6568XpjpWZEDcCkIkBQQBCgcaUupbx6uZvNwKIiQFBAEIANwKAiQEL6AIBA39BAEEAKAKAiQEiASAAakH/////AXEiAjYCgIkBQQAoAoSJASEDAkAgAiABTw0AQQAgA0EBaiIDNgKEiQELQQAgAyAAQR12ajYChIkBAkACQAJAAkACQAJAIAFBP3EiAw0AQYAJIQIMAQtBwAAgA2siAiAASw0BIANBGGohA0EAIQEDQCADIAFqQYCJAWogAUGACWotAAA6AAAgAyABQQFqIgFqQdgARw0AC0GYiQFBwAAQAxogACACayEAIAJBgAlqIQILIABBwABPDQEgACEDDAILIABFDQJBACEBIANBmIkBakEALQCACToAACAAQQFGDQIgA0GZiQFqIQMgAEF/aiECA0AgAyABaiABQYEJai0AADoAACACIAFBAWoiAUcNAAwDCwsgAEE/cSEDIAIgAEFAcRADIQILIANFDQBBACEBA0AgAUGYiQFqIAIgAWotAAA6AAAgAyABQQFqIgFHDQALCwuYCwEXf0EAKAKUiQEhAkEAKAKQiQEhA0EAKAKMiQEhBEEAKAKIiQEhBQNAIABBHGooAgAiBiAAQRRqKAIAIgcgAEEYaigCACIIIABBEGooAgAiCSAAQSxqKAIAIgogAEEoaigCACILIABBJGooAgAiDCAAQSBqKAIAIg0gCyAIIABBCGooAgAiDiADaiAAQQRqKAIAIg8gAmogBCADIAJzcSACcyAFaiAAKAIAIhBqQQN3IhEgBCADc3EgA3NqQQd3IhIgESAEc3EgBHNqQQt3IhNqIBIgB2ogESAJaiAAQQxqKAIAIhQgBGogEyASIBFzcSARc2pBE3ciESATIBJzcSASc2pBA3ciEiARIBNzcSATc2pBB3ciEyASIBFzcSARc2pBC3ciFWogEyAMaiASIA1qIBEgBmogFSATIBJzcSASc2pBE3ciESAVIBNzcSATc2pBA3ciEiARIBVzcSAVc2pBB3ciEyASIBFzcSARc2pBC3ciFSAAQThqKAIAIhZqIBMgAEE0aigCACIXaiASIABBMGooAgAiGGogESAKaiAVIBMgEnNxIBJzakETdyISIBUgE3NxIBNzakEDdyITIBIgFXNxIBVzakEHdyIVIBMgEnNxIBJzakELdyIRaiAJIBVqIBAgE2ogEiAAQTxqKAIAIglqIBEgFSATc3EgE3NqQRN3IhIgESAVcnEgESAVcXJqQZnzidQFakEDdyITIBIgEXJxIBIgEXFyakGZ84nUBWpBBXciESATIBJycSATIBJxcmpBmfOJ1AVqQQl3IhVqIAcgEWogDyATaiAYIBJqIBUgESATcnEgESATcXJqQZnzidQFakENdyISIBUgEXJxIBUgEXFyakGZ84nUBWpBA3ciESASIBVycSASIBVxcmpBmfOJ1AVqQQV3IhMgESAScnEgESAScXJqQZnzidQFakEJdyIVaiAIIBNqIA4gEWogFyASaiAVIBMgEXJxIBMgEXFyakGZ84nUBWpBDXciESAVIBNycSAVIBNxcmpBmfOJ1AVqQQN3IhIgESAVcnEgESAVcXJqQZnzidQFakEFdyITIBIgEXJxIBIgEXFyakGZ84nUBWpBCXciFWogBiATaiAUIBJqIBYgEWogFSATIBJycSATIBJxcmpBmfOJ1AVqQQ13IhEgFSATcnEgFSATcXJqQZnzidQFakEDdyISIBEgFXJxIBEgFXFyakGZ84nUBWpBBXciEyASIBFycSASIBFxcmpBmfOJ1AVqQQl3IhVqIBAgEmogCSARaiAVIBMgEnJxIBMgEnFyakGZ84nUBWpBDXciBiAVcyISIBNzakGh1+f2BmpBA3ciESAGcyANIBNqIBIgEXNqQaHX5/YGakEJdyISc2pBodfn9gZqQQt3IhNqIA4gEWogEyAScyAYIAZqIBIgEXMgE3NqQaHX5/YGakEPdyIRc2pBodfn9gZqQQN3IhUgEXMgCyASaiARIBNzIBVzakGh1+f2BmpBCXciEnNqQaHX5/YGakELdyITaiAPIBVqIBMgEnMgFiARaiASIBVzIBNzakGh1+f2BmpBD3ciEXNqQaHX5/YGakEDdyIVIBFzIAwgEmogESATcyAVc2pBodfn9gZqQQl3IhJzakGh1+f2BmpBC3ciE2ogFCAVaiATIBJzIBcgEWogEiAVcyATc2pBodfn9gZqQQ93IhFzakGh1+f2BmpBA3ciFSARcyAKIBJqIBEgE3MgFXNqQaHX5/YGakEJdyISc2pBodfn9gZqQQt3IhMgA2ohAyAJIBFqIBIgFXMgE3NqQaHX5/YGakEPdyAEaiEEIBIgAmohAiAVIAVqIQUgAEHAAGohACABQUBqIgENAAtBACACNgKUiQFBACADNgKQiQFBACAENgKMiQFBACAFNgKIiQEgAAuhAgEDf0EAKAKAiQEiAEE/cSIBQZiJAWpBgAE6AAACQAJAAkAgAUE/cyICQQdLDQACQCACRQ0AIAFBmYkBaiEAA0AgAEEAOgAAIABBAWohACACQX9qIgINAAsLQcAAIQJBmIkBQcAAEAMaQQAhAAwBCyACQQhGDQEgAUEBaiEACyAAQY+JAWohAQNAIAEgAmpBADoAACACQXdqIQAgAkF/aiECIABBAEoNAAtBACgCgIkBIQALQQAgAEEVdjoA04kBQQAgAEENdjoA0okBQQAgAEEFdjoA0YkBQQAgAEEDdCICOgDQiQFBACACNgKAiQFBAEEAKAKEiQE2AtSJAUGYiQFBwAAQAxpBAEEAKQKIiQE3A4AJQQBBACkCkIkBNwOICQsGAEGAiQELMwBBAEL+uevF6Y6VmRA3ApCJAUEAQoHGlLqW8ermbzcCiIkBQQBCADcCgIkBIAAQAhAECwsLAQBBgAgLBJgAAAA=";
var hash$e = "1bf01052";
var wasmJson$e = {
	name: name$e,
	data: data$e,
	hash: hash$e
};

const mutex$f = new Mutex();
let wasmCache$f = null;
/**
 * Calculates MD4 hash
 * @param data Input data (string, Buffer or TypedArray)
 * @returns Computed hash as a hexadecimal string
 */
function md4(data) {
    if (wasmCache$f === null) {
        return lockedCreate(mutex$f, wasmJson$e, 16)
            .then((wasm) => {
            wasmCache$f = wasm;
            return wasmCache$f.calculate(data);
        });
    }
    try {
        const hash = wasmCache$f.calculate(data);
        return Promise.resolve(hash);
    }
    catch (err) {
        return Promise.reject(err);
    }
}
/**
 * Creates a new MD4 hash instance
 */
function createMD4() {
    return WASMInterface(wasmJson$e, 16).then((wasm) => {
        wasm.init();
        const obj = {
            init: () => { wasm.init(); return obj; },
            update: (data) => { wasm.update(data); return obj; },
            digest: (outputType) => wasm.digest(outputType),
            save: () => wasm.save(),
            load: (data) => { wasm.load(data); return obj; },
            blockSize: 64,
            digestSize: 16,
        };
        return obj;
    });
}

var name$d = "md5";
var data$d = "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";
var hash$d = "9b0fac7d";
var wasmJson$d = {
	name: name$d,
	data: data$d,
	hash: hash$d
};

const mutex$e = new Mutex();
let wasmCache$e = null;
/**
 * Calculates MD5 hash
 * @param data Input data (string, Buffer or TypedArray)
 * @returns Computed hash as a hexadecimal string
 */
function md5(data) {
    if (wasmCache$e === null) {
        return lockedCreate(mutex$e, wasmJson$d, 16)
            .then((wasm) => {
            wasmCache$e = wasm;
            return wasmCache$e.calculate(data);
        });
    }
    try {
        const hash = wasmCache$e.calculate(data);
        return Promise.resolve(hash);
    }
    catch (err) {
        return Promise.reject(err);
    }
}
/**
 * Creates a new MD5 hash instance
 */
function createMD5() {
    return WASMInterface(wasmJson$d, 16).then((wasm) => {
        wasm.init();
        const obj = {
            init: () => { wasm.init(); return obj; },
            update: (data) => { wasm.update(data); return obj; },
            digest: (outputType) => wasm.digest(outputType),
            save: () => wasm.save(),
            load: (data) => { wasm.load(data); return obj; },
            blockSize: 64,
            digestSize: 16,
        };
        return obj;
    });
}

var name$c = "sha1";
var data$c = "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";
var hash$c = "40d92e5d";
var wasmJson$c = {
	name: name$c,
	data: data$c,
	hash: hash$c
};

const mutex$d = new Mutex();
let wasmCache$d = null;
/**
 * Calculates SHA-1 hash
 * @param data Input data (string, Buffer or TypedArray)
 * @returns Computed hash as a hexadecimal string
 */
function sha1(data) {
    if (wasmCache$d === null) {
        return lockedCreate(mutex$d, wasmJson$c, 20)
            .then((wasm) => {
            wasmCache$d = wasm;
            return wasmCache$d.calculate(data);
        });
    }
    try {
        const hash = wasmCache$d.calculate(data);
        return Promise.resolve(hash);
    }
    catch (err) {
        return Promise.reject(err);
    }
}
/**
 * Creates a new SHA-1 hash instance
 */
function createSHA1() {
    return WASMInterface(wasmJson$c, 20).then((wasm) => {
        wasm.init();
        const obj = {
            init: () => { wasm.init(); return obj; },
            update: (data) => { wasm.update(data); return obj; },
            digest: (outputType) => wasm.digest(outputType),
            save: () => wasm.save(),
            load: (data) => { wasm.load(data); return obj; },
            blockSize: 64,
            digestSize: 20,
        };
        return obj;
    });
}

var name$b = "sha3";
var data$b = "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";
var hash$b = "ec266d91";
var wasmJson$b = {
	name: name$b,
	data: data$b,
	hash: hash$b
};

const mutex$c = new Mutex();
let wasmCache$c = null;
function validateBits$1(bits) {
    if (![224, 256, 384, 512].includes(bits)) {
        return new Error('Invalid variant! Valid values: 224, 256, 384, 512');
    }
    return null;
}
/**
 * Calculates SHA-3 hash
 * @param data Input data (string, Buffer or TypedArray)
 * @param bits Number of output bits. Valid values: 224, 256, 384, 512
 * @returns Computed hash as a hexadecimal string
 */
function sha3(data, bits = 512) {
    if (validateBits$1(bits)) {
        return Promise.reject(validateBits$1(bits));
    }
    const hashLength = bits / 8;
    if (wasmCache$c === null || wasmCache$c.hashLength !== hashLength) {
        return lockedCreate(mutex$c, wasmJson$b, hashLength)
            .then((wasm) => {
            wasmCache$c = wasm;
            return wasmCache$c.calculate(data, bits, 0x06);
        });
    }
    try {
        const hash = wasmCache$c.calculate(data, bits, 0x06);
        return Promise.resolve(hash);
    }
    catch (err) {
        return Promise.reject(err);
    }
}
/**
 * Creates a new SHA-3 hash instance
 * @param bits Number of output bits. Valid values: 224, 256, 384, 512
 */
function createSHA3(bits = 512) {
    if (validateBits$1(bits)) {
        return Promise.reject(validateBits$1(bits));
    }
    const outputSize = bits / 8;
    return WASMInterface(wasmJson$b, outputSize).then((wasm) => {
        wasm.init(bits);
        const obj = {
            init: () => { wasm.init(bits); return obj; },
            update: (data) => { wasm.update(data); return obj; },
            digest: (outputType) => wasm.digest(outputType, 0x06),
            save: () => wasm.save(),
            load: (data) => { wasm.load(data); return obj; },
            blockSize: 200 - 2 * outputSize,
            digestSize: outputSize,
        };
        return obj;
    });
}

const mutex$b = new Mutex();
let wasmCache$b = null;
function validateBits(bits) {
    if (![224, 256, 384, 512].includes(bits)) {
        return new Error('Invalid variant! Valid values: 224, 256, 384, 512');
    }
    return null;
}
/**
 * Calculates Keccak hash
 * @param data Input data (string, Buffer or TypedArray)
 * @param bits Number of output bits. Valid values: 224, 256, 384, 512
 * @returns Computed hash as a hexadecimal string
 */
function keccak(data, bits = 512) {
    if (validateBits(bits)) {
        return Promise.reject(validateBits(bits));
    }
    const hashLength = bits / 8;
    if (wasmCache$b === null || wasmCache$b.hashLength !== hashLength) {
        return lockedCreate(mutex$b, wasmJson$b, hashLength)
            .then((wasm) => {
            wasmCache$b = wasm;
            return wasmCache$b.calculate(data, bits, 0x01);
        });
    }
    try {
        const hash = wasmCache$b.calculate(data, bits, 0x01);
        return Promise.resolve(hash);
    }
    catch (err) {
        return Promise.reject(err);
    }
}
/**
 * Creates a new Keccak hash instance
 * @param bits Number of output bits. Valid values: 224, 256, 384, 512
 */
function createKeccak(bits = 512) {
    if (validateBits(bits)) {
        return Promise.reject(validateBits(bits));
    }
    const outputSize = bits / 8;
    return WASMInterface(wasmJson$b, outputSize).then((wasm) => {
        wasm.init(bits);
        const obj = {
            init: () => { wasm.init(bits); return obj; },
            update: (data) => { wasm.update(data); return obj; },
            digest: (outputType) => wasm.digest(outputType, 0x01),
            save: () => wasm.save(),
            load: (data) => { wasm.load(data); return obj; },
            blockSize: 200 - 2 * outputSize,
            digestSize: outputSize,
        };
        return obj;
    });
}

var name$a = "sha256";
var data$a = "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";
var hash$a = "817d957e";
var wasmJson$a = {
	name: name$a,
	data: data$a,
	hash: hash$a
};

const mutex$a = new Mutex();
let wasmCache$a = null;
/**
 * Calculates SHA-2 (SHA-224) hash
 * @param data Input data (string, Buffer or TypedArray)
 * @returns Computed hash as a hexadecimal string
 */
function sha224(data) {
    if (wasmCache$a === null) {
        return lockedCreate(mutex$a, wasmJson$a, 28)
            .then((wasm) => {
            wasmCache$a = wasm;
            return wasmCache$a.calculate(data, 224);
        });
    }
    try {
        const hash = wasmCache$a.calculate(data, 224);
        return Promise.resolve(hash);
    }
    catch (err) {
        return Promise.reject(err);
    }
}
/**
 * Creates a new SHA-2 (SHA-224) hash instance
 */
function createSHA224() {
    return WASMInterface(wasmJson$a, 28).then((wasm) => {
        wasm.init(224);
        const obj = {
            init: () => { wasm.init(224); return obj; },
            update: (data) => { wasm.update(data); return obj; },
            digest: (outputType) => wasm.digest(outputType),
            save: () => wasm.save(),
            load: (data) => { wasm.load(data); return obj; },
            blockSize: 64,
            digestSize: 28,
        };
        return obj;
    });
}

const mutex$9 = new Mutex();
let wasmCache$9 = null;
/**
 * Calculates SHA-2 (SHA-256) hash
 * @param data Input data (string, Buffer or TypedArray)
 * @returns Computed hash as a hexadecimal string
 */
function sha256(data) {
    if (wasmCache$9 === null) {
        return lockedCreate(mutex$9, wasmJson$a, 32)
            .then((wasm) => {
            wasmCache$9 = wasm;
            return wasmCache$9.calculate(data, 256);
        });
    }
    try {
        const hash = wasmCache$9.calculate(data, 256);
        return Promise.resolve(hash);
    }
    catch (err) {
        return Promise.reject(err);
    }
}
/**
 * Creates a new SHA-2 (SHA-256) hash instance
 */
function createSHA256() {
    return WASMInterface(wasmJson$a, 32).then((wasm) => {
        wasm.init(256);
        const obj = {
            init: () => { wasm.init(256); return obj; },
            update: (data) => { wasm.update(data); return obj; },
            digest: (outputType) => wasm.digest(outputType),
            save: () => wasm.save(),
            load: (data) => { wasm.load(data); return obj; },
            blockSize: 64,
            digestSize: 32,
        };
        return obj;
    });
}

var name$9 = "sha512";
var data$9 = "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";
var hash$9 = "a5d1ca7c";
var wasmJson$9 = {
	name: name$9,
	data: data$9,
	hash: hash$9
};

const mutex$8 = new Mutex();
let wasmCache$8 = null;
/**
 * Calculates SHA-2 (SHA-384) hash
 * @param data Input data (string, Buffer or TypedArray)
 * @returns Computed hash as a hexadecimal string
 */
function sha384(data) {
    if (wasmCache$8 === null) {
        return lockedCreate(mutex$8, wasmJson$9, 48)
            .then((wasm) => {
            wasmCache$8 = wasm;
            return wasmCache$8.calculate(data, 384);
        });
    }
    try {
        const hash = wasmCache$8.calculate(data, 384);
        return Promise.resolve(hash);
    }
    catch (err) {
        return Promise.reject(err);
    }
}
/**
 * Creates a new SHA-2 (SHA-384) hash instance
 */
function createSHA384() {
    return WASMInterface(wasmJson$9, 48).then((wasm) => {
        wasm.init(384);
        const obj = {
            init: () => { wasm.init(384); return obj; },
            update: (data) => { wasm.update(data); return obj; },
            digest: (outputType) => wasm.digest(outputType),
            save: () => wasm.save(),
            load: (data) => { wasm.load(data); return obj; },
            blockSize: 128,
            digestSize: 48,
        };
        return obj;
    });
}

const mutex$7 = new Mutex();
let wasmCache$7 = null;
/**
 * Calculates SHA-2 (SHA-512) hash
 * @param data Input data (string, Buffer or TypedArray)
 * @returns Computed hash as a hexadecimal string
 */
function sha512(data) {
    if (wasmCache$7 === null) {
        return lockedCreate(mutex$7, wasmJson$9, 64)
            .then((wasm) => {
            wasmCache$7 = wasm;
            return wasmCache$7.calculate(data, 512);
        });
    }
    try {
        const hash = wasmCache$7.calculate(data, 512);
        return Promise.resolve(hash);
    }
    catch (err) {
        return Promise.reject(err);
    }
}
/**
 * Creates a new SHA-2 (SHA-512) hash instance
 */
function createSHA512() {
    return WASMInterface(wasmJson$9, 64).then((wasm) => {
        wasm.init(512);
        const obj = {
            init: () => { wasm.init(512); return obj; },
            update: (data) => { wasm.update(data); return obj; },
            digest: (outputType) => wasm.digest(outputType),
            save: () => wasm.save(),
            load: (data) => { wasm.load(data); return obj; },
            blockSize: 128,
            digestSize: 64,
        };
        return obj;
    });
}

var name$8 = "xxhash32";
var data$8 = "AGFzbQEAAAABEQRgAAF/YAF/AGAAAGACf38AAwcGAAEBAgADBAUBcAEBAQUEAQECAgYOAn8BQbCJBQt/AEGACAsHcAgGbWVtb3J5AgAOSGFzaF9HZXRCdWZmZXIAAAlIYXNoX0luaXQAAQtIYXNoX1VwZGF0ZQACCkhhc2hfRmluYWwAAw1IYXNoX0dldFN0YXRlAAQOSGFzaF9DYWxjdWxhdGUABQpTVEFURV9TSVpFAwEKswkGBQBBgAkLTQBBAEIANwOoiQFBACAANgKIiQFBACAAQc+Moo4GajYCjIkBQQAgAEH3lK+veGo2AoSJAUEAIABBqIiNoQJqNgKAiQFBAEEANgKgiQELswUBBn8CQCAARQ0AQQBBACkDqIkBIACtfDcDqIkBAkBBACgCoIkBIgEgAGpBD0sNAEEAIAFBAWo2AqCJASABQZCJAWpBAC0AgAk6AAAgAEEBRg0BQQEhAgNAQQBBACgCoIkBIgFBAWo2AqCJASABQZCJAWogAkGACWotAAA6AAAgACACQQFqIgJHDQAMAgsLIABB8AhqIQMCQAJAIAENAEEAKAKMiQEhAUEAKAKIiQEhBEEAKAKEiQEhBUEAKAKAiQEhBkGACSECDAELQYAJIQICQCABQQ9LDQBBgAkhAgNAIAItAAAhBEEAIAFBAWo2AqCJASABQZCJAWogBDoAACACQQFqIQJBACgCoIkBIgFBEEkNAAsLQQBBACgCkIkBQfeUr694bEEAKAKAiQFqQQ13QbHz3fF5bCIGNgKAiQFBAEEAKAKUiQFB95Svr3hsQQAoAoSJAWpBDXdBsfPd8XlsIgU2AoSJAUEAQQAoApiJAUH3lK+veGxBACgCiIkBakENd0Gx893xeWwiBDYCiIkBQQBBACgCnIkBQfeUr694bEEAKAKMiQFqQQ13QbHz3fF5bCIBNgKMiQELIABBgAlqIQACQCACIANLDQADQCACKAIAQfeUr694bCAGakENd0Gx893xeWwhBiACQQxqKAIAQfeUr694bCABakENd0Gx893xeWwhASACQQhqKAIAQfeUr694bCAEakENd0Gx893xeWwhBCACQQRqKAIAQfeUr694bCAFakENd0Gx893xeWwhBSACQRBqIgIgA00NAAsLQQAgATYCjIkBQQAgBDYCiIkBQQAgBTYChIkBQQAgBjYCgIkBQQAgACACayIBNgKgiQEgAUUNAEEAIQEDQCABQZCJAWogAiABai0AADoAACABQQFqIgFBACgCoIkBSQ0ACwsLzAICAX4Gf0EAKQOoiQEiAKchAQJAAkAgAEIQVA0AQQAoAoSJAUEHd0EAKAKAiQFBAXdqQQAoAoiJAUEMd2pBACgCjIkBQRJ3aiECDAELQQAoAoiJAUGxz9myAWohAgsgAiABaiECQZCJASEBQQAoAqCJASIDQZCJAWohBAJAIANBBEgNAEGQiQEhBQNAIAUoAgBBvdzKlXxsIAJqQRF3Qa/W074CbCECIAVBCGohBiAFQQRqIgEhBSAGIARNDQALCwJAIAEgBEYNACADQZCJAWohBQNAIAEtAABBsc/ZsgFsIAJqQQt3QbHz3fF5bCECIAUgAUEBaiIBRw0ACwtBACACQQ92IAJzQfeUr694bCIBQQ12IAFzQb3cypV8bCIBQRB2IAFzIgFBGHQgAUEIdEGAgPwHcXIgAUEIdkGA/gNxIAFBGHZycq03A4AJCwYAQYCJAQtTAEEAQgA3A6iJAUEAIAE2AoiJAUEAIAFBz4yijgZqNgKMiQFBACABQfeUr694ajYChIkBQQAgAUGoiI2hAmo2AoCJAUEAQQA2AqCJASAAEAIQAwsLCwEAQYAICwQwAAAA";
var hash$8 = "5b6a5062";
var wasmJson$8 = {
	name: name$8,
	data: data$8,
	hash: hash$8
};

const mutex$6 = new Mutex();
let wasmCache$6 = null;
function validateSeed$3(seed) {
    if (!Number.isInteger(seed) || seed < 0 || seed > 0xFFFFFFFF) {
        return new Error('Seed must be a valid 32-bit long unsigned integer.');
    }
    return null;
}
/**
 * Calculates xxHash32 hash
 * @param data Input data (string, Buffer or TypedArray)
 * @param seed Number used to initialize the internal state of the algorithm (defaults to 0)
 * @returns Computed hash as a hexadecimal string
 */
function xxhash32(data, seed = 0) {
    if (validateSeed$3(seed)) {
        return Promise.reject(validateSeed$3(seed));
    }
    if (wasmCache$6 === null) {
        return lockedCreate(mutex$6, wasmJson$8, 4)
            .then((wasm) => {
            wasmCache$6 = wasm;
            return wasmCache$6.calculate(data, seed);
        });
    }
    try {
        const hash = wasmCache$6.calculate(data, seed);
        return Promise.resolve(hash);
    }
    catch (err) {
        return Promise.reject(err);
    }
}
/**
 * Creates a new xxHash32 hash instance
 * @param data Input data (string, Buffer or TypedArray)
 * @param seed Number used to initialize the internal state of the algorithm (defaults to 0)
 */
function createXXHash32(seed = 0) {
    if (validateSeed$3(seed)) {
        return Promise.reject(validateSeed$3(seed));
    }
    return WASMInterface(wasmJson$8, 4).then((wasm) => {
        wasm.init(seed);
        const obj = {
            init: () => { wasm.init(seed); return obj; },
            update: (data) => { wasm.update(data); return obj; },
            digest: (outputType) => wasm.digest(outputType),
            save: () => wasm.save(),
            load: (data) => { wasm.load(data); return obj; },
            blockSize: 16,
            digestSize: 4,
        };
        return obj;
    });
}

var name$7 = "xxhash64";
var data$7 = "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";
var hash$7 = "bc315b2a";
var wasmJson$7 = {
	name: name$7,
	data: data$7,
	hash: hash$7
};

const mutex$5 = new Mutex();
let wasmCache$5 = null;
const seedBuffer$2 = new ArrayBuffer(8);
function validateSeed$2(seed) {
    if (!Number.isInteger(seed) || seed < 0 || seed > 0xFFFFFFFF) {
        return new Error('Seed must be given as two valid 32-bit long unsigned integers (lo + high).');
    }
    return null;
}
function writeSeed$2(arr, low, high) {
    // write in little-endian format
    const buffer = new DataView(arr);
    buffer.setUint32(0, low, true);
    buffer.setUint32(4, high, true);
}
/**
 * Calculates xxHash64 hash
 * @param data Input data (string, Buffer or TypedArray)
 * @param seedLow Lower 32 bits of the number used to
 *  initialize the internal state of the algorithm (defaults to 0)
 * @param seedHigh Higher 32 bits of the number used to
 *  initialize the internal state of the algorithm (defaults to 0)
 * @returns Computed hash as a hexadecimal string
 */
function xxhash64(data, seedLow = 0, seedHigh = 0) {
    if (validateSeed$2(seedLow)) {
        return Promise.reject(validateSeed$2(seedLow));
    }
    if (validateSeed$2(seedHigh)) {
        return Promise.reject(validateSeed$2(seedHigh));
    }
    if (wasmCache$5 === null) {
        return lockedCreate(mutex$5, wasmJson$7, 8)
            .then((wasm) => {
            wasmCache$5 = wasm;
            writeSeed$2(seedBuffer$2, seedLow, seedHigh);
            wasmCache$5.writeMemory(new Uint8Array(seedBuffer$2));
            return wasmCache$5.calculate(data);
        });
    }
    try {
        writeSeed$2(seedBuffer$2, seedLow, seedHigh);
        wasmCache$5.writeMemory(new Uint8Array(seedBuffer$2));
        const hash = wasmCache$5.calculate(data);
        return Promise.resolve(hash);
    }
    catch (err) {
        return Promise.reject(err);
    }
}
/**
 * Creates a new xxHash64 hash instance
 * @param seedLow Lower 32 bits of the number used to
 *  initialize the internal state of the algorithm (defaults to 0)
 * @param seedHigh Higher 32 bits of the number used to
 *  initialize the internal state of the algorithm (defaults to 0)
 */
function createXXHash64(seedLow = 0, seedHigh = 0) {
    if (validateSeed$2(seedLow)) {
        return Promise.reject(validateSeed$2(seedLow));
    }
    if (validateSeed$2(seedHigh)) {
        return Promise.reject(validateSeed$2(seedHigh));
    }
    return WASMInterface(wasmJson$7, 8).then((wasm) => {
        const instanceBuffer = new ArrayBuffer(8);
        writeSeed$2(instanceBuffer, seedLow, seedHigh);
        wasm.writeMemory(new Uint8Array(instanceBuffer));
        wasm.init();
        const obj = {
            init: () => {
                wasm.writeMemory(new Uint8Array(instanceBuffer));
                wasm.init();
                return obj;
            },
            update: (data) => { wasm.update(data); return obj; },
            digest: (outputType) => wasm.digest(outputType),
            save: () => wasm.save(),
            load: (data) => { wasm.load(data); return obj; },
            blockSize: 32,
            digestSize: 8,
        };
        return obj;
    });
}

var name$6 = "xxhash3";
var data$6 = "AGFzbQEAAAABJAZgAAF/YAR/f39/AGAHf39/f39/fwBgA39/fgF+YAAAYAF/AAMMCwABAgMDAwQFBAAEBAUBcAEBAQUEAQECAgYOAn8BQcCOBQt/AEHACQsHcAgGbWVtb3J5AgAOSGFzaF9HZXRCdWZmZXIAAAlIYXNoX0luaXQABgtIYXNoX1VwZGF0ZQAHCkhhc2hfRmluYWwACA1IYXNoX0dldFN0YXRlAAkOSGFzaF9DYWxjdWxhdGUACgpTVEFURV9TSVpFAwEK+joLBQBBgAoL7wMBEH4CQCADRQ0AIAFBOGohASACQThqIQIgACkDMCEEIAApAzghBSAAKQMgIQYgACkDKCEHIAApAxAhCCAAKQMYIQkgACkDACEKIAApAwghCwNAIAcgAUFoaikDACIMfCACQXBqKQMAIAFBcGopAwAiDYUiB0IgiCAHQv////8Pg358IQcgCSABQVhqKQMAIg58IAJBYGopAwAgAUFgaikDACIPhSIJQiCIIAlC/////w+DfnwhCSALIAFBSGopAwAiEHwgAkFQaikDACABQVBqKQMAIhGFIgtCIIggC0L/////D4N+fCELIAJBeGopAwAgAUF4aikDACIShSITQiCIIBNC/////w+DfiAEfCABKQMAIhN8IQQgAkFoaikDACAMhSIMQiCIIAxC/////w+DfiAGfCANfCEGIAJBWGopAwAgDoUiDEIgiCAMQv////8Pg34gCHwgD3whCCACQUhqKQMAIBCFIgxCIIggDEL/////D4N+IAp8IBF8IQogBSASfCACKQMAIBOFIgVCIIggBUL/////D4N+fCEFIAFBwABqIQEgAkEIaiECIANBf2oiAw0ACyAAIAk3AxggACAKNwMAIAAgCzcDCCAAIAc3AyggACAINwMQIAAgBTcDOCAAIAY3AyAgACAENwMwCwveAgIBfwF+AkAgAiABKAIAIgdrIgIgBEsNACAAIAMgBSAHQQN0aiACEAEgACAAKQMAIgggBSAGaiIHKQMAhSAIQi+IhUKx893xCX43AwAgACAAKQMIIgggBykDCIUgCEIviIVCsfPd8Ql+NwMIIAAgACkDECIIIAcpAxCFIAhCL4iFQrHz3fEJfjcDECAAIAApAxgiCCAHKQMYhSAIQi+IhUKx893xCX43AxggACAAKQMgIgggBykDIIUgCEIviIVCsfPd8Ql+NwMgIAAgACkDKCIIIAcpAyiFIAhCL4iFQrHz3fEJfjcDKCAAIAApAzAiCCAHKQMwhSAIQi+IhUKx893xCX43AzAgACAAKQM4IgggBykDOIUgCEIviIVCsfPd8Ql+NwM4IAAgAyACQQZ0aiAFIAQgAmsiBxABIAEgBzYCAA8LIAAgAyAFIAdBA3RqIAQQASABIAcgBGo2AgAL3QQBBH4CQCAAQQlJDQBBACkDgIwBIAEpAyAgASkDGIUgAnyFIgNCOIYgA0IohkKAgICAgIDA/wCDhCADQhiGQoCAgICA4D+DIANCCIZCgICAgPAfg4SEIANCCIhCgICA+A+DIANCGIhCgID8B4OEIANCKIhCgP4DgyADQjiIhISEIACtfCAAQfiLAWopAwAgASkDMCABKQMohSACfYUiAnwgAkL/////D4MiBCADQiCIIgV+IgZC/////w+DIAJCIIgiAiADQv////8PgyIDfnwgBCADfiIDQiCIfCIEQiCGIANC/////w+DhCAGQiCIIAIgBX58IARCIIh8hXwiA0IliCADhUL5893xmfKZqxZ+IgNCIIggA4UPCwJAIABBBEkNACABKQMQIAEpAwiFIAKnIgFBGHQgAUEIdEGAgPwHcXIgAUEIdkGA/gNxIAFBGHZycq1CIIYgAoV9QQA1AoCMAUIghiAAQfyLAWo1AgCEhSIDQhiJIAOFIANCMYmFQqW+4/TRjIfZn39+IgNCI4ggAK18IAOFQqW+4/TRjIfZn39+IgNCHIggA4UPCwJAIABFDQAgASgCBCABKAIAc60gAnwiA0EALQCAjAFBEHQgAEEIdHIgAEEBdkGAjAFqLQAAQRh0ciAAQf+LAWotAAByrYUgA0IhiIVCz9bTvtLHq9lCfiIDQh2IIAOFQvnz3fGZ9pmrFn4iA0IgiCADhQ8LIAEpAzggAoUgASkDQIUiA0IhiCADhULP1tO+0ser2UJ+IgNCHYggA4VC+fPd8Zn2masWfiIDQiCIIAOFC94IAQZ+IACtQoeVr6+Ytt6bnn9+IQMCQCAAQSFJDQACQCAAQcEASQ0AAkAgAEHhAEkNACABKQNoIAJ9QQApA7iMAYUiBEL/////D4MiBSABKQNgIAJ8QQApA7CMAYUiBkIgiCIHfiIIQv////8PgyAEQiCIIgQgBkL/////D4MiBn58IAUgBn4iBUIgiHwiBkIghiAFQv////8Pg4QgCEIgiCAEIAd+fCAGQiCIfIUgA3wgASkDeCACfSAAQciLAWopAwCFIgNC/////w+DIgQgASkDcCACfCAAQcCLAWopAwCFIgVCIIgiBn4iB0L/////D4MgA0IgiCIDIAVC/////w+DIgV+fCAEIAV+IgRCIIh8IgVCIIYgBEL/////D4OEIAdCIIggAyAGfnwgBUIgiHyFfCEDCyABKQNIIAJ9QQApA6iMAYUiBEL/////D4MiBSABKQNAIAJ8QQApA6CMAYUiBkIgiCIHfiIIQv////8PgyAEQiCIIgQgBkL/////D4MiBn58IAUgBn4iBUIgiHwiBkIghiAFQv////8Pg4QgCEIgiCAEIAd+fCAGQiCIfIUgA3wgASkDWCACfSAAQdiLAWopAwCFIgNC/////w+DIgQgASkDUCACfCAAQdCLAWopAwCFIgVCIIgiBn4iB0L/////D4MgA0IgiCIDIAVC/////w+DIgV+fCAEIAV+IgRCIIh8IgVCIIYgBEL/////D4OEIAdCIIggAyAGfnwgBUIgiHyFfCEDCyABKQMoIAJ9QQApA5iMAYUiBEL/////D4MiBSABKQMgIAJ8QQApA5CMAYUiBkIgiCIHfiIIQv////8PgyAEQiCIIgQgBkL/////D4MiBn58IAUgBn4iBUIgiHwiBkIghiAFQv////8Pg4QgCEIgiCAEIAd+fCAGQiCIfIUgA3wgASkDOCACfSAAQeiLAWopAwCFIgNC/////w+DIgQgASkDMCACfCAAQeCLAWopAwCFIgVCIIgiBn4iB0L/////D4MgA0IgiCIDIAVC/////w+DIgV+fCAEIAV+IgRCIIh8IgVCIIYgBEL/////D4OEIAdCIIggAyAGfnwgBUIgiHyFfCEDCyABKQMIIAJ9QQApA4iMAYUiBEL/////D4MiBSABKQMAIAJ8QQApA4CMAYUiBkIgiCIHfiIIQv////8PgyAEQiCIIgQgBkL/////D4MiBn58IAUgBn4iBUIgiHwiBkIghiAFQv////8Pg4QgCEIgiCAEIAd+fCAGQiCIfIUgA3wgASkDGCACfSAAQfiLAWopAwCFIgNC/////w+DIgQgASkDECACfCAAQfCLAWopAwCFIgJCIIgiBX4iBkL/////D4MgA0IgiCIDIAJC/////w+DIgJ+fCAEIAJ+IgJCIIh8IgRCIIYgAkL/////D4OEIAZCIIggAyAFfnwgBEIgiHyFfCICQiWIIAKFQvnz3fGZ8pmrFn4iAkIgiCAChQuICwQBfwV+An8BfkEAIQMgASkDeCACfUEAKQP4jAGFIgRC/////w+DIgUgASkDcCACfEEAKQPwjAGFIgZCIIgiB34iCEL/////D4MgBEIgiCIEIAZC/////w+DIgZ+fCAFIAZ+IgVCIIh8IgZCIIYgBUL/////D4OEIAhCIIggBCAHfnwgBkIgiHyFIAEpA2ggAn1BACkD6IwBhSIEQv////8PgyIFIAEpA2AgAnxBACkD4IwBhSIGQiCIIgd+IghC/////w+DIARCIIgiBCAGQv////8PgyIGfnwgBSAGfiIFQiCIfCIGQiCGIAVC/////w+DhCAIQiCIIAQgB358IAZCIIh8hSABKQNYIAJ9QQApA9iMAYUiBEL/////D4MiBSABKQNQIAJ8QQApA9CMAYUiBkIgiCIHfiIIQv////8PgyAEQiCIIgQgBkL/////D4MiBn58IAUgBn4iBUIgiHwiBkIghiAFQv////8Pg4QgCEIgiCAEIAd+fCAGQiCIfIUgASkDSCACfUEAKQPIjAGFIgRC/////w+DIgUgASkDQCACfEEAKQPAjAGFIgZCIIgiB34iCEL/////D4MgBEIgiCIEIAZC/////w+DIgZ+fCAFIAZ+IgVCIIh8IgZCIIYgBUL/////D4OEIAhCIIggBCAHfnwgBkIgiHyFIAEpAzggAn1BACkDuIwBhSIEQv////8PgyIFIAEpAzAgAnxBACkDsIwBhSIGQiCIIgd+IghC/////w+DIARCIIgiBCAGQv////8PgyIGfnwgBSAGfiIFQiCIfCIGQiCGIAVC/////w+DhCAIQiCIIAQgB358IAZCIIh8hSABKQMoIAJ9QQApA6iMAYUiBEL/////D4MiBSABKQMgIAJ8QQApA6CMAYUiBkIgiCIHfiIIQv////8PgyAEQiCIIgQgBkL/////D4MiBn58IAUgBn4iBUIgiHwiBkIghiAFQv////8Pg4QgCEIgiCAEIAd+fCAGQiCIfIUgASkDGCACfUEAKQOYjAGFIgRC/////w+DIgUgASkDECACfEEAKQOQjAGFIgZCIIgiB34iCEL/////D4MgBEIgiCIEIAZC/////w+DIgZ+fCAFIAZ+IgVCIIh8IgZCIIYgBUL/////D4OEIAhCIIggBCAHfnwgBkIgiHyFIAEpAwggAn1BACkDiIwBhSIEQv////8PgyIFIAEpAwAgAnxBACkDgIwBhSIGQiCIIgd+IghC/////w+DIARCIIgiBCAGQv////8PgyIGfnwgBSAGfiIFQiCIfCIGQiCGIAVC/////w+DhCAIQiCIIAQgB358IAZCIIh8hSAArUKHla+vmLbem55/fnx8fHx8fHx8IgRCJYggBIVC+fPd8ZnymasWfiIEQiCIIASFIQQgAEEQbSEJAkAgAEGQAUgNACAJQQkgCUEJShtBeGohCQNAIAEgA2oiCkELaikDACACfSADQYiNAWopAwCFIgVC/////w+DIgYgCkEDaikDACACfCADQYCNAWopAwCFIgdCIIgiCH4iC0L/////D4MgBUIgiCIFIAdC/////w+DIgd+fCAGIAd+IgZCIIh8IgdCIIYgBkL/////D4OEIAtCIIggBSAIfnwgB0IgiHyFIAR8IQQgA0EQaiEDIAlBf2oiCQ0ACwsgASkDfyACfSAAQfiLAWopAwCFIgVC/////w+DIgYgASkDdyACfCAAQfCLAWopAwCFIgJCIIgiB34iCEL/////D4MgBUIgiCIFIAJC/////w+DIgJ+fCAGIAJ+IgJCIIh8IgZCIIYgAkL/////D4OEIAhCIIggBSAHfnwgBkIgiHyFIAR8IgJCJYggAoVC+fPd8ZnymasWfiICQiCIIAKFC98FAgF+AX8CQAJAQQApA4AKIgBQRQ0AQYAIIQFCACEADAELAkBBACkDoI4BIABSDQBBACEBDAELQQAhAUEAQq+v79e895Kg/gAgAH03A/iLAUEAIABCxZbr+djShYIofDcD8IsBQQBCj/Hjja2P9JhOIAB9NwPoiwFBACAAQqus+MXV79HQfHw3A+CLAUEAQtOt1LKShbW0nn8gAH03A9iLAUEAIABCl5r0jvWWvO3JAHw3A9CLAUEAQsWDgv2v/8SxayAAfTcDyIsBQQAgAELqi7OdyOb09UN8NwPAiwFBAELIv/rLnJveueQAIAB9NwO4iwFBACAAQoqjgd/Ume2sMXw3A7CLAUEAQvm57738+MKnHSAAfTcDqIsBQQAgAEKo9dv7s5ynmj98NwOgiwFBAEK4sry3lNW31lggAH03A5iLAUEAIABC8cihuqm0w/zOAHw3A5CLAUEAQoihl9u445SXo38gAH03A4iLAUEAIABCvNDI2pvysIBLfDcDgIsBQQBC4OvAtJ7QjpPMACAAfTcD+IoBQQAgAEK4kZii9/6Qko5/fDcD8IoBQQBCgrXB7sf5v7khIAB9NwPoigFBACAAQsvzmffEmfDy+AB8NwPgigFBAELygJGl+vbssx8gAH03A9iKAUEAIABC3qm3y76Q5MtbfDcD0IoBQQBC/IKE5PK+yNYcIAB9NwPIigFBACAAQrj9s8uzhOmlvn98NwPAigELQQBCADcDkI4BQQBCADcDiI4BQQBCADcDgI4BQQAgATYCsI4BQQAgADcDoI4BQQBCsfPd8Qk3A7iKAUEAQsXP2bLx5brqJzcDsIoBQQBC95Svrwg3A6iKAUEAQuPcypX8zvL1hX83A6CKAUEAQvnz3fGZ9pmrFjcDmIoBQQBCz9bTvtLHq9lCNwOQigFBAEKHla+vmLbem55/NwOIigFBAEK93MqVDDcDgIoBQQBCkICAgIAQNwOYjgELwAUBBX9BAEEAKQOQjgEgAK18NwOQjgECQAJAQQAoAoCOASIBIABqIgJBgAJLDQAgAUGAjAFqIQNBgAohBAJAAkAgAEEITw0AIAAhAQwBCyAAIQEDQCADIAQpAwA3AwAgA0EIaiEDIARBCGohBCABQXhqIgFBB0sNAAsLIAFFDQEDQCADIAQtAAA6AAAgA0EBaiEDIARBAWohBCABQX9qIgENAAtBACgCgI4BIABqIQIMAQtBgAohAyAAQYAKaiECQQAoArCOASIEQcCKASAEGyEAAkAgAUUNACABQYCMAWohA0GACiEEAkACQEGAAiABayIFQQhPDQAgBSEBDAELIAUhAQNAIAMgBCkDADcDACADQQhqIQMgBEEIaiEEIAFBeGoiAUEHSw0ACwsCQCABRQ0AA0AgAyAELQAAOgAAIANBAWohAyAEQQFqIQQgAUF/aiIBDQALC0GAigFBiI4BQQAoApiOAUGAjAFBBCAAQQAoApyOARACQQBBADYCgI4BIAVBgApqIQMLAkAgA0GAAmogAk8NACACQYB+aiEEA0BBgIoBQYiOAUEAKAKYjgEgA0EEIABBACgCnI4BEAIgA0GAAmoiAyAESQ0AC0EAIANBQGopAwA3A8CNAUEAIANBSGopAwA3A8iNAUEAIANBUGopAwA3A9CNAUEAIANBWGopAwA3A9iNAUEAIANBYGopAwA3A+CNAUEAIANBaGopAwA3A+iNAUEAIANBcGopAwA3A/CNAUEAIANBeGopAwA3A/iNAQtBgIwBIQQCQAJAIAIgA2siAkEITw0AIAIhAQwBCyACIQEDQCAEIAMpAwA3AwAgBEEIaiEEIANBCGohAyABQXhqIgFBB0sNAAsLIAFFDQADQCAEIAMtAAA6AAAgBEEBaiEEIANBAWohAyABQX9qIgENAAsLQQAgAjYCgI4BC6oQBQR/AX4Cfwp+An8jACIAIQEgAEGAAWtBQHEiAiQAQQAoArCOASIAQcCKASAAGyEDAkACQEEAKQOQjgEiBELxAVQNACACQQApA4CKATcDACACQQApA4iKATcDCCACQQApA5CKATcDECACQQApA5iKATcDGCACQQApA6CKATcDICACQQApA6iKATcDKCACQQApA7CKATcDMCACQQApA7iKATcDOAJAAkBBACgCgI4BIgVBwABJDQAgAkEAKAKIjgE2AkAgAiACQcAAakEAKAKYjgFBgIwBIAVBf2pBBnYgA0EAKAKcjgEQAiACIAIpAwhBACgCgI4BIgBBwIsBaikDACIEfCADQQAoApyOAWoiBkEBaikDACAAQciLAWopAwAiB4UiCEIgiCAIQv////8Pg358Igk3AwggAiACKQMYIABB0IsBaikDACIIfCAGQRFqKQMAIABB2IsBaikDACIKhSILQiCIIAtC/////w+DfnwiDDcDGCACIAcgBCAGQXlqKQMAhSIEQiCIIARC/////w+DfiACKQMAfHwiDTcDACACIAogCCAGQQlqKQMAhSIEQiCIIARC/////w+DfiACKQMQfHwiDjcDECAGQRlqKQMAIQQgAikDICEHIAIgAikDKCAAQeCLAWopAwAiCHwgBkEhaikDACAAQeiLAWopAwAiCoUiC0IgiCALQv////8Pg358Ig83AyggAiAKIAcgBCAIhSIEQiCIIARC/////w+Dfnx8IhA3AyAgAiACKQM4IABB8IsBaikDACIEfCAGQTFqKQMAIABB+IsBaikDACIHhSIIQiCIIAhC/////w+Dfnw3AzggByAEIAZBKWopAwCFIgRCIIggBEL/////D4N+IAIpAzB8fCEEDAELQcAAIAVrIRECQAJAAkAgBUE4TQ0AQYCOASARayEGIAJBwABqIQUgESEADAELQQAhEiARIQADQCACQcAAaiASaiAFIBJqQcCNAWopAwA3AwAgEkEIaiESIABBeGoiAEEHSw0ACyAFIBJqIgZBwABGDQEgBkHAjQFqIQYgAkHAAGogEmohBQsDQCAFIAYtAAA6AAAgBUEBaiEFIAZBAWohBiAAQX9qIgANAAtBACgCgI4BIQULIAJBwABqIBFqIQZBgIwBIQACQCAFQQhJDQBBgIwBIQADQCAGIAApAwA3AwAgBkEIaiEGIABBCGohACAFQXhqIgVBB0sNAAsLAkAgBUUNAANAIAYgAC0AADoAACAGQQFqIQYgAEEBaiEAIAVBf2oiBQ0ACwsgAiACKQMIIAIpA0AiBHwgA0EAKAKcjgFqIgBBAWopAwAgAikDSCIHhSIIQiCIIAhC/////w+DfnwiCTcDCCACIAIpAxggAikDUCIIfCAAQRFqKQMAIAIpA1giCoUiC0IgiCALQv////8Pg358Igw3AxggAiAHIAQgAEF5aikDAIUiBEIgiCAEQv////8Pg34gAikDAHx8Ig03AwAgAiAKIAggAEEJaikDAIUiBEIgiCAEQv////8Pg34gAikDEHx8Ig43AxAgAEEZaikDACEEIAIpAyAhByACIAIpAyggAikDYCIIfCAAQSFqKQMAIAIpA2giCoUiC0IgiCALQv////8Pg358Ig83AyggAiAKIAcgBCAIhSIEQiCIIARC/////w+Dfnx8IhA3AyAgAiACKQM4IAIpA3AiBHwgAEExaikDACACKQN4IgeFIghCIIggCEL/////D4N+fDcDOCAHIAQgAEEpaikDAIUiBEIgiCAEQv////8Pg34gAikDMHx8IQQLIAIgBDcDMCADKQNDIAIpAziFIgdC/////w+DIgggAykDOyAEhSIEQiCIIgp+IgtC/////w+DIAdCIIgiByAEQv////8PgyIEfnwgCCAEfiIEQiCIfCIIQiCGIARC/////w+DhCALQiCIIAcgCn58IAhCIIh8hSADKQMzIA+FIgRC/////w+DIgcgAykDKyAQhSIIQiCIIgp+IgtC/////w+DIARCIIgiBCAIQv////8PgyIIfnwgByAIfiIHQiCIfCIIQiCGIAdC/////w+DhCALQiCIIAQgCn58IAhCIIh8hSADKQMjIAyFIgRC/////w+DIgcgAykDGyAOhSIIQiCIIgp+IgtC/////w+DIARCIIgiBCAIQv////8PgyIIfnwgByAIfiIHQiCIfCIIQiCGIAdC/////w+DhCALQiCIIAQgCn58IAhCIIh8hSADKQMTIAmFIgRC/////w+DIgcgAykDCyANhSIIQiCIIgp+IgtC/////w+DIARCIIgiBCAIQv////8PgyIIfnwgByAIfiIHQiCIfCIIQiCGIAdC/////w+DhCALQiCIIAQgCn58IAhCIIh8hUEAKQOQjgFCh5Wvr5i23puef358fHx8IgRCJYggBIVC+fPd8ZnymasWfiIEQiCIIASFIQQMAQsgBKchAAJAQQApA6COASIEUA0AAkAgAEEQSw0AIABBgAggBBADIQQMAgsCQCAAQYABSw0AIABBgAggBBAEIQQMAgsgAEGACCAEEAUhBAwBCwJAIABBEEsNACAAIANCABADIQQMAQsCQCAAQYABSw0AIAAgA0IAEAQhBAwBCyAAIANCABAFIQQLQQAgBEI4hiAEQiiGQoCAgICAgMD/AIOEIARCGIZCgICAgIDgP4MgBEIIhkKAgICA8B+DhIQgBEIIiEKAgID4D4MgBEIYiEKAgPwHg4QgBEIoiEKA/gODIARCOIiEhIQ3A4AKIAEkAAsGAEGAigELAgALC8wBAQBBgAgLxAG4/mw5I6RLvnwBgSz3Ia0c3tRt6YOQl9tyQKSkt7NnH8t55k7MwOV4glrQfcz/ciG4CEZ090MkjuA1kOaBOiZMPChSu5HDAMuI0GWLG1Muo3FkSJeiDflOOBnvRqnerNio+nY/45w0P/ncu8fHC08dilHgS820WTHIn37J2XhzZOrFrIM00+vDxYGg//oTY+sXDd1Rt/DaSdMWVSYp1GieKxa+WH1HofyP+LjRetAxzkXLOo+VFgQor9f7yrtLQH5AAgAA";
var hash$6 = "187bc2c6";
var wasmJson$6 = {
	name: name$6,
	data: data$6,
	hash: hash$6
};

const mutex$4 = new Mutex();
let wasmCache$4 = null;
const seedBuffer$1 = new ArrayBuffer(8);
function validateSeed$1(seed) {
    if (!Number.isInteger(seed) || seed < 0 || seed > 0xFFFFFFFF) {
        return new Error('Seed must be given as two valid 32-bit long unsigned integers (lo + high).');
    }
    return null;
}
function writeSeed$1(arr, low, high) {
    // write in little-endian format
    const buffer = new DataView(arr);
    buffer.setUint32(0, low, true);
    buffer.setUint32(4, high, true);
}
/**
 * Calculates xxHash3 hash
 * @param data Input data (string, Buffer or TypedArray)
 * @param seedLow Lower 32 bits of the number used to
 *  initialize the internal state of the algorithm (defaults to 0)
 * @param seedHigh Higher 32 bits of the number used to
 *  initialize the internal state of the algorithm (defaults to 0)
 * @returns Computed hash as a hexadecimal string
 */
function xxhash3(data, seedLow = 0, seedHigh = 0) {
    if (validateSeed$1(seedLow)) {
        return Promise.reject(validateSeed$1(seedLow));
    }
    if (validateSeed$1(seedHigh)) {
        return Promise.reject(validateSeed$1(seedHigh));
    }
    if (wasmCache$4 === null) {
        return lockedCreate(mutex$4, wasmJson$6, 8)
            .then((wasm) => {
            wasmCache$4 = wasm;
            writeSeed$1(seedBuffer$1, seedLow, seedHigh);
            wasmCache$4.writeMemory(new Uint8Array(seedBuffer$1));
            return wasmCache$4.calculate(data);
        });
    }
    try {
        writeSeed$1(seedBuffer$1, seedLow, seedHigh);
        wasmCache$4.writeMemory(new Uint8Array(seedBuffer$1));
        const hash = wasmCache$4.calculate(data);
        return Promise.resolve(hash);
    }
    catch (err) {
        return Promise.reject(err);
    }
}
/**
 * Creates a new xxHash3 hash instance
 * @param seedLow Lower 32 bits of the number used to
 *  initialize the internal state of the algorithm (defaults to 0)
 * @param seedHigh Higher 32 bits of the number used to
 *  initialize the internal state of the algorithm (defaults to 0)
 */
function createXXHash3(seedLow = 0, seedHigh = 0) {
    if (validateSeed$1(seedLow)) {
        return Promise.reject(validateSeed$1(seedLow));
    }
    if (validateSeed$1(seedHigh)) {
        return Promise.reject(validateSeed$1(seedHigh));
    }
    return WASMInterface(wasmJson$6, 8).then((wasm) => {
        const instanceBuffer = new ArrayBuffer(8);
        writeSeed$1(instanceBuffer, seedLow, seedHigh);
        wasm.writeMemory(new Uint8Array(instanceBuffer));
        wasm.init();
        const obj = {
            init: () => {
                wasm.writeMemory(new Uint8Array(instanceBuffer));
                wasm.init();
                return obj;
            },
            update: (data) => { wasm.update(data); return obj; },
            digest: (outputType) => wasm.digest(outputType),
            save: () => wasm.save(),
            load: (data) => { wasm.load(data); return obj; },
            blockSize: 512,
            digestSize: 8,
        };
        return obj;
    });
}

var name$5 = "xxhash128";
var data$5 = "AGFzbQEAAAABKwdgAAF/YAR/f39/AGAHf39/f39/fwBgA39/fgF+YAR/f39+AGAAAGABfwADDQwAAQIDBAQEBQYFAAUEBQFwAQEBBQQBAQICBg4CfwFBwI4FC38AQcAJCwdwCAZtZW1vcnkCAA5IYXNoX0dldEJ1ZmZlcgAACUhhc2hfSW5pdAAHC0hhc2hfVXBkYXRlAAgKSGFzaF9GaW5hbAAJDUhhc2hfR2V0U3RhdGUACg5IYXNoX0NhbGN1bGF0ZQALClNUQVRFX1NJWkUDAQrKRgwFAEGACgvvAwEQfgJAIANFDQAgAUE4aiEBIAJBOGohAiAAKQMwIQQgACkDOCEFIAApAyAhBiAAKQMoIQcgACkDECEIIAApAxghCSAAKQMAIQogACkDCCELA0AgByABQWhqKQMAIgx8IAJBcGopAwAgAUFwaikDACINhSIHQiCIIAdC/////w+DfnwhByAJIAFBWGopAwAiDnwgAkFgaikDACABQWBqKQMAIg+FIglCIIggCUL/////D4N+fCEJIAsgAUFIaikDACIQfCACQVBqKQMAIAFBUGopAwAiEYUiC0IgiCALQv////8Pg358IQsgAkF4aikDACABQXhqKQMAIhKFIhNCIIggE0L/////D4N+IAR8IAEpAwAiE3whBCACQWhqKQMAIAyFIgxCIIggDEL/////D4N+IAZ8IA18IQYgAkFYaikDACAOhSIMQiCIIAxC/////w+DfiAIfCAPfCEIIAJBSGopAwAgEIUiDEIgiCAMQv////8Pg34gCnwgEXwhCiAFIBJ8IAIpAwAgE4UiBUIgiCAFQv////8Pg358IQUgAUHAAGohASACQQhqIQIgA0F/aiIDDQALIAAgCTcDGCAAIAo3AwAgACALNwMIIAAgBzcDKCAAIAg3AxAgACAFNwM4IAAgBjcDICAAIAQ3AzALC94CAgF/AX4CQCACIAEoAgAiB2siAiAESw0AIAAgAyAFIAdBA3RqIAIQASAAIAApAwAiCCAFIAZqIgcpAwCFIAhCL4iFQrHz3fEJfjcDACAAIAApAwgiCCAHKQMIhSAIQi+IhUKx893xCX43AwggACAAKQMQIgggBykDEIUgCEIviIVCsfPd8Ql+NwMQIAAgACkDGCIIIAcpAxiFIAhCL4iFQrHz3fEJfjcDGCAAIAApAyAiCCAHKQMghSAIQi+IhUKx893xCX43AyAgACAAKQMoIgggBykDKIUgCEIviIVCsfPd8Ql+NwMoIAAgACkDMCIIIAcpAzCFIAhCL4iFQrHz3fEJfjcDMCAAIAApAzgiCCAHKQM4hSAIQi+IhUKx893xCX43AzggACADIAJBBnRqIAUgBCACayIHEAEgASAHNgIADwsgACADIAUgB0EDdGogBBABIAEgByAEajYCAAvtAwEFfiABKQM4IAApAziFIgNC/////w+DIgQgASkDMCAAKQMwhSIFQiCIIgZ+IgdC/////w+DIANCIIgiAyAFQv////8PgyIFfnwgBCAFfiIEQiCIfCIFQiCGIARC/////w+DhCAHQiCIIAMgBn58IAVCIIh8hSABKQMoIAApAyiFIgNC/////w+DIgQgASkDICAAKQMghSIFQiCIIgZ+IgdC/////w+DIANCIIgiAyAFQv////8PgyIFfnwgBCAFfiIEQiCIfCIFQiCGIARC/////w+DhCAHQiCIIAMgBn58IAVCIIh8hSABKQMYIAApAxiFIgNC/////w+DIgQgASkDECAAKQMQhSIFQiCIIgZ+IgdC/////w+DIANCIIgiAyAFQv////8PgyIFfnwgBCAFfiIEQiCIfCIFQiCGIARC/////w+DhCAHQiCIIAMgBn58IAVCIIh8hSABKQMIIAApAwiFIgNC/////w+DIgQgASkDACAAKQMAhSIFQiCIIgZ+IgdC/////w+DIANCIIgiAyAFQv////8PgyIFfnwgBCAFfiIEQiCIfCIFQiCGIARC/////w+DhCAHQiCIIAMgBn58IAVCIIh8hSACfHx8fCICQiWIIAKFQvnz3fGZ8pmrFn4iAkIgiCAChQvCCAEFfgJAIAFBCUkNACAAQQApA4CMASACKQMoIAIpAyCFIAN9hSABQfiLAWopAwAiBIUiBUIgiCIGQoeVr68IfiIHQv////8PgyAFQv////8PgyIFQrHz3fEJfnwgBUKHla+vCH4iBUIgiHwiCEIghiAFQv////8Pg4QgAUF/aq1CNoZ8IAQgAikDOCACKQMwhSADfIUiA0L/////D4NC95Svrwh+IANCgICAgHCDfCAGQrHz3fEJfnwgB0IgiHwgCEIgiHwiA0I4hiADQiiGQoCAgICAgMD/AIOEIANCGIZCgICAgIDgP4MgA0IIhkKAgICA8B+DhIQgA0IIiEKAgID4D4MgA0IYiEKAgPwHg4QgA0IoiEKA/gODIANCOIiEhISFIgRCIIgiBULP1tO+An4iBkL/////D4MgBEL/////D4MiBEK93MqVDH58IARCz9bTvgJ+IgdCIIh8IgRCBYhC////P4MgBEIghiAHQv////8Pg4SFQvnz3fGZ8pmrFn4iB0IgiCAHhTcDACAAIAVCvdzKlQx+IANCz9bTvtLHq9lCfnwgBkIgiHwgBEIgiHwiA0IliCADhUL5893xmfKZqxZ+IgNCIIggA4U3AwgPCwJAIAFBBEkNACAAIAIpAxggAikDEIUgA6ciAkEYdCACQQh0QYCA/AdxciACQQh2QYD+A3EgAkEYdnJyrUIghiADhXwgAUH8iwFqNQIAQiCGQQA1AoCMAYSFIgNCIIgiBCABQQJ0QYeVr694aq0iBX4iBkIgiCAEQrHz3fEJfnwgBkL/////D4MgA0L/////D4MiA0Kx893xCX58IAMgBX4iA0IgiHwiBEIgiHwgBEIghiADQv////8Pg4QiBEIBhnwiA0IliCADhUL5893xmfKZqxZ+IgVCIIggBYU3AwggACADQgOIIASFIgNCI4ggA4VCpb7j9NGMh9mff34iA0IciCADhTcDAA8LAkAgAUUNACAAIAIoAgQgAigCAHOtIAN8IgRBAC0AgIwBQRB0IAFBCHRyIAFBAXZBgIwBai0AAEEYdHIgAUH/iwFqLQAAciIBrYUgBEIhiIVCz9bTvtLHq9lCfiIEQh2IIASFQvnz3fGZ9pmrFn4iBEIgiCAEhTcDACAAIAIoAgwgAigCCHOtIAN9IgMgAUEYdCABQQh0QYCA/AdxciABQQh2QYD+A3EgAUEYdnJyQQ13rYUgA0IhiIVCz9bTvtLHq9lCfiIDQh2IIAOFQvnz3fGZ9pmrFn4iA0IgiCADhTcDCA8LIAAgAikDUCADhSACKQNYhSIEQiGIIASFQs/W077Sx6vZQn4iBEIdiCAEhUL5893xmfaZqxZ+IgRCIIggBIU3AwggACACKQNAIAOFIAIpA0iFIgNCIYggA4VCz9bTvtLHq9lCfiIDQh2IIAOFQvnz3fGZ9pmrFn4iA0IgiCADhTcDAAunCgEKfiABrSIEQoeVr6+Ytt6bnn9+IQUCQAJAIAFBIU8NAEIAIQYMAQtCACEHAkAgAUHBAEkNAEIAIQcCQCABQeEASQ0AIAIpA3ggA30gAUHIiwFqKQMAIgiFIgdC/////w+DIgkgAikDcCADfCABQcCLAWopAwAiCoUiC0IgiCIMfiINQiCIIAdCIIgiByAMfnwgDUL/////D4MgByALQv////8PgyILfnwgCSALfiIHQiCIfCIJQiCIfEEAKQO4jAEiC0EAKQOwjAEiDHyFIAlCIIYgB0L/////D4OEhSEHIAIpA2ggA30gC4UiCUL/////D4MiCyACKQNgIAN8IAyFIgxCIIgiDX4iBkL/////D4MgCUIgiCIJIAxC/////w+DIgx+fCALIAx+IgtCIIh8IgxCIIYgC0L/////D4OEIAZCIIggCSANfnwgDEIgiHyFIAV8IAggCnyFIQULIAIpA1ggA30gAUHYiwFqKQMAIgiFIglC/////w+DIgogAikDUCADfCABQdCLAWopAwAiC4UiDEIgiCINfiIGQv////8PgyAJQiCIIgkgDEL/////D4MiDH58IAogDH4iCkIgiHwiDEIghiAKQv////8Pg4QgBkIgiCAJIA1+fCAMQiCIfIUgB3xBACkDqIwBIglBACkDoIwBIgp8hSEHIAIpA0ggA30gCYUiCUL/////D4MiDCACKQNAIAN8IAqFIgpCIIgiDX4iBkL/////D4MgCUIgiCIJIApC/////w+DIgp+fCAMIAp+IgpCIIh8IgxCIIYgCkL/////D4OEIAZCIIggCSANfnwgDEIgiHyFIAV8IAggC3yFIQULIAIpAzggA30gAUHoiwFqKQMAIgiFIglC/////w+DIgogAikDMCADfCABQeCLAWopAwAiC4UiDEIgiCINfiIGQv////8PgyAJQiCIIgkgDEL/////D4MiDH58IAogDH4iCkIgiHwiDEIghiAKQv////8Pg4QgBkIgiCAJIA1+fCAMQiCIfIUgB3xBACkDmIwBIgdBACkDkIwBIgl8hSEGIAIpAyggA30gB4UiB0L/////D4MiCiACKQMgIAN8IAmFIglCIIgiDH4iDUL/////D4MgB0IgiCIHIAlC/////w+DIgl+fCAKIAl+IglCIIh8IgpCIIYgCUL/////D4OEIA1CIIggByAMfnwgCkIgiHyFIAV8IAggC3yFIQULIAAgAikDGCADfSABQfiLAWopAwAiB4UiCEL/////D4MiCSACKQMQIAN8IAFB8IsBaikDACIKhSILQiCIIgx+Ig1C/////w+DIAhCIIgiCCALQv////8PgyILfnwgCSALfiIJQiCIfCILQiCGIAlC/////w+DhCANQiCIIAggDH58IAtCIIh8hSAGfEEAKQOIjAEiCEEAKQOAjAEiCXyFIgsgAikDCCADfSAIhSIIQv////8PgyIMIAIpAwAgA3wgCYUiCUIgiCINfiIGQv////8PgyAIQiCIIgggCUL/////D4MiCX58IAwgCX4iCUIgiHwiDEIghiAJQv////8Pg4QgBkIgiCAIIA1+fCAMQiCIfIUgBXwgByAKfIUiBXwiB0IliCAHhUL5893xmfKZqxZ+IgdCIIggB4U3AwAgAEIAIAVCh5Wvr5i23puef34gBCADfULP1tO+0ser2UJ+fCALQuPcypX8zvL1hX9+fCIDQiWIIAOFQvnz3fGZ8pmrFn4iA0IgiCADhX03AwgLiQ8DAX8UfgJ/QQAhBCACKQN4IAN9QQApA/iMASIFhSIGQv////8PgyIHIAIpA3AgA3xBACkD8IwBIgiFIglCIIgiCn4iC0L/////D4MgBkIgiCIGIAlC/////w+DIgl+fCAHIAl+IgdCIIh8IglCIIYgB0L/////D4OEIAtCIIggBiAKfnwgCUIgiHyFIAIpA1ggA31BACkD2IwBIgeFIgZC/////w+DIgkgAikDUCADfEEAKQPQjAEiCoUiC0IgiCIMfiINQv////8PgyAGQiCIIgYgC0L/////D4MiC358IAkgC34iCUIgiHwiC0IghiAJQv////8Pg4QgDUIgiCAGIAx+fCALQiCIfIUgAikDOCADfUEAKQO4jAEiCYUiBkL/////D4MiCyACKQMwIAN8QQApA7CMASIMhSINQiCIIg5+Ig9C/////w+DIAZCIIgiBiANQv////8PgyINfnwgCyANfiILQiCIfCINQiCGIAtC/////w+DhCAPQiCIIAYgDn58IA1CIIh8hSACKQMYIAN9QQApA5iMASILhSIGQv////8PgyINIAIpAxAgA3xBACkDkIwBIg6FIg9CIIgiEH4iEUL/////D4MgBkIgiCIGIA9C/////w+DIg9+fCANIA9+Ig1CIIh8Ig9CIIYgDUL/////D4OEIBFCIIggBiAQfnwgD0IgiHyFQQApA4iMASINQQApA4CMASIPfIV8QQApA6iMASIQQQApA6CMASIRfIV8QQApA8iMASISQQApA8CMASITfIV8QQApA+iMASIUQQApA+CMASIVfIUiBkIliCAGhUL5893xmfKZqxZ+IgZCIIggBoUhBiACKQNoIAN9IBSFIhRC/////w+DIhYgAikDYCADfCAVhSIVQiCIIhd+IhhC/////w+DIBRCIIgiFCAVQv////8PgyIVfnwgFiAVfiIVQiCIfCIWQiCGIBVC/////w+DhCAYQiCIIBQgF358IBZCIIh8hSACKQNIIAN9IBKFIhJC/////w+DIhQgAikDQCADfCAThSITQiCIIhV+IhZC/////w+DIBJCIIgiEiATQv////8PgyITfnwgFCATfiITQiCIfCIUQiCGIBNC/////w+DhCAWQiCIIBIgFX58IBRCIIh8hSACKQMoIAN9IBCFIhBC/////w+DIhIgAikDICADfCARhSIRQiCIIhN+IhRC/////w+DIBBCIIgiECARQv////8PgyIRfnwgEiARfiIRQiCIfCISQiCGIBFC/////w+DhCAUQiCIIBAgE358IBJCIIh8hSACKQMIIAN9IA2FIg1C/////w+DIhAgAikDACADfCAPhSIPQiCIIhF+IhJC/////w+DIA1CIIgiDSAPQv////8PgyIPfnwgECAPfiIPQiCIfCIQQiCGIA9C/////w+DhCASQiCIIA0gEX58IBBCIIh8hSABrSIPQoeVr6+Ytt6bnn9+fCALIA58hXwgCSAMfIV8IAcgCnyFfCAFIAh8hSIFQiWIIAWFQvnz3fGZ8pmrFn4iBUIgiCAFhSEFIAFBIG0hGQJAIAFBoAFIDQAgGUEFIBlBBUobQXxqIRoDQCACIARqIhlBG2opAwAgA30gBEGYjQFqKQMAIgeFIghC/////w+DIgkgGUETaikDACADfCAEQZCNAWopAwAiCoUiC0IgiCIMfiINQv////8PgyAIQiCIIgggC0L/////D4MiC358IAkgC34iCUIgiHwiC0IghiAJQv////8Pg4QgDUIgiCAIIAx+fCALQiCIfIUgBnwgBEGIjQFqKQMAIgggBEGAjQFqKQMAIgl8hSEGIBlBC2opAwAgA30gCIUiCEL/////D4MiCyAZQQNqKQMAIAN8IAmFIglCIIgi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QXBqKQMANwPwjQFBACADQXhqKQMANwP4jQELQYCMASEEAkACQCACIANrIgJBCE8NACACIQEMAQsgAiEBA0AgBCADKQMANwMAIARBCGohBCADQQhqIQMgAUF4aiIBQQdLDQALCyABRQ0AA0AgBCADLQAAOgAAIARBAWohBCADQQFqIQMgAUF/aiIBDQALC0EAIAI2AoCOAQvcDgUEfwF+An8EfgJ/IwAiACEBIABBgAFrQUBxIgAkAEEAKAKwjgEiAkHAigEgAhshAwJAAkBBACkDkI4BIgRC8QFUDQAgAEEAKQOAigE3AwAgAEEAKQOIigE3AwggAEEAKQOQigE3AxAgAEEAKQOYigE3AxggAEEAKQOgigE3AyAgAEEAKQOoigE3AyggAEEAKQOwigE3AzAgAEEAKQO4igE3AzgCQAJAQQAoAoCOASIFQcAASQ0AIABBACgCiI4BNgJAIAAgAEHAAGpBACgCmI4BQYCMASAFQX9qQQZ2IANBACgCnI4BEAIgACAAKQMIQQAoAoCOASICQcCLAWopAwAiBHwgA0EAKAKcjgFqIgZBAWopAwAgAkHIiwFqKQMAIgeFIghCIIggCEL/////D4N+fDcDCCAAIAApAxggAkHQiwFqKQMAIgh8IAZBEWopAwAgAkHYiwFqKQMAIgmFIgpCIIggCkL/////D4N+fDcDGCAAIAcgBCAGQXlqKQMAhSIEQiCIIARC/////w+DfiAAKQMAfHw3AwAgACAJIAggBkEJaikDAIUiBEIgiCAEQv////8Pg34gACkDEHx8NwMQIAZBGWopAwAhBCAAKQMgIQcgACAAKQMoIAJB4IsBaikDACIIfCAGQSFqKQMAIAJB6IsBaikDACIJhSIKQiCIIApC/////w+Dfnw3AyggACAJIAcgBCAIhSIEQiCIIARC/////w+Dfnx8NwMgIAAgACkDOCACQfCLAWopAwAiBHwgBkExaikDACACQfiLAWopAwAiB4UiCEIgiCAIQv////8Pg358NwM4IAAgByAEIAZBKWopAwCFIgRCIIggBEL/////D4N+IAApAzB8fDcDMAwBC0HAACAFayELAkACQAJAIAVBOE0NAEGAjgEgC2shBiAAQcAAaiEFIAshAgwBC0EAIQwgCyECA0AgAEHAAGogDGogBSAMakHAjQFqKQMANwMAIAxBCGohDCACQXhqIgJBB0sNAAsgBSAMaiIGQcAARg0BIAZBwI0BaiEGIABBwABqIAxqIQULA0AgBSAGLQAAOgAAIAVBAWohBSAGQQFqIQYgAkF/aiICDQALQQAoAoCOASEFCyAAQcAAaiALaiEGQYCMASECAkAgBUEISQ0AQYCMASECA0AgBiACKQMANwMAIAZBCGohBiACQQhqIQIgBUF4aiIFQQdLDQALCwJAIAVFDQADQCAGIAItAAA6AAAgBkEBaiEGIAJBAWohAiAFQX9qIgUNAAsLIAAgACkDCCAAKQNAIgR8IANBACgCnI4BaiICQQFqKQMAIAApA0giB4UiCEIgiCAIQv////8Pg358NwMIIAAgACkDGCAAKQNQIgh8IAJBEWopAwAgACkDWCIJhSIKQiCIIApC/////w+Dfnw3AxggACAHIAQgAkF5aikDAIUiBEIgiCAEQv////8Pg34gACkDAHx8NwMAIAAgCSAIIAJBCWopAwCFIgRCIIggBEL/////D4N+IAApAxB8fDcDECACQRlqKQMAIQQgACkDICEHIAAgACkDKCAAKQNgIgh8IAJBIWopAwAgACkDaCIJhSIKQiCIIApC/////w+Dfnw3AyggACAJIAcgBCAIhSIEQiCIIARC/////w+Dfnx8NwMgIAAgACkDOCAAKQNwIgR8IAJBMWopAwAgACkDeCIHhSIIQiCIIAhC/////w+Dfnw3AzggACAHIAQgAkEpaikDAIUiBEIgiCAEQv////8Pg34gACkDMHx8NwMwCyAAIAAgA0ELakEAKQOQjgEiBEKHla+vmLbem55/fhADNwNAIAAgACADQQAoApyOAWpBdWogBELP1tO+0ser2UJ+Qn+FEAM3A0gMAQsgBKchAgJAQQApA6COASIEUA0AAkAgAkEQSw0AIABBwABqIAJBgAggBBAEDAILAkAgAkGAAUsNACAAQcAAaiACQYAIIAQQBQwCCyAAQcAAaiACQYAIIAQQBgwBCwJAIAJBEEsNACAAQcAAaiACIANCABAEDAELAkAgAkGAAUsNACAAQcAAaiACIANCABAFDAELIABBwABqIAIgA0IAEAYLQQAgAEH4AGopAwA3A8AKQQAgAEHwAGopAwA3A7gKQQAgAEHoAGopAwA3A7AKQQAgAEHgAGopAwA3A6gKQQAgAEHYAGopAwA3A6AKQQAgAEHQAGopAwA3A5gKQQAgACkDSCIEQjiGIARCKIZCgICAgICAwP8Ag4QgBEIYhkKAgICAgOA/gyAEQgiGQoCAgIDwH4OEhCAEQgiIQoCAgPgPgyAEQhiIQoCA/AeDhCAEQiiIQoD+A4MgBEI4iISEhCIENwOACkEAIAQ3A5AKQQAgACkDQCIEQjiGIARCKIZCgICAgICAwP8Ag4QgBEIYhkKAgICAgOA/gyAEQgiGQoCAgIDwH4OEhCAEQgiIQoCAgPgPgyAEQhiIQoCA/AeDhCAEQiiIQoD+A4MgBEI4iISEhDcDiAogASQACwYAQYCKAQsCAAsLzAEBAEGACAvEAbj+bDkjpEu+fAGBLPchrRze1G3pg5CX23JApKS3s2cfy3nmTszA5XiCWtB9zP9yIbgIRnT3QySO4DWQ5oE6Jkw8KFK7kcMAy4jQZYsbUy6jcWRIl6IN+U44Ge9Gqd6s2Kj6dj/jnDQ/+dy7x8cLTx2KUeBLzbRZMciffsnZeHNk6sWsgzTT68PFgaD/+hNj6xcN3VG38NpJ0xZVJinUaJ4rFr5YfUeh/I/4uNF60DHORcs6j5UWBCiv1/vKu0tAfkACAAA=";
var hash$5 = "e8e3fcf8";
var wasmJson$5 = {
	name: name$5,
	data: data$5,
	hash: hash$5
};

const mutex$3 = new Mutex();
let wasmCache$3 = null;
const seedBuffer = new ArrayBuffer(8);
function validateSeed(seed) {
    if (!Number.isInteger(seed) || seed < 0 || seed > 0xFFFFFFFF) {
        return new Error('Seed must be given as two valid 32-bit long unsigned integers (lo + high).');
    }
    return null;
}
function writeSeed(arr, low, high) {
    // write in little-endian format
    const buffer = new DataView(arr);
    buffer.setUint32(0, low, true);
    buffer.setUint32(4, high, true);
}
/**
 * Calculates xxHash128 hash
 * @param data Input data (string, Buffer or TypedArray)
 * @param seedLow Lower 32 bits of the number used to
 *  initialize the internal state of the algorithm (defaults to 0)
 * @param seedHigh Higher 32 bits of the number used to
 *  initialize the internal state of the algorithm (defaults to 0)
 * @returns Computed hash as a hexadecimal string
 */
function xxhash128(data, seedLow = 0, seedHigh = 0) {
    if (validateSeed(seedLow)) {
        return Promise.reject(validateSeed(seedLow));
    }
    if (validateSeed(seedHigh)) {
        return Promise.reject(validateSeed(seedHigh));
    }
    if (wasmCache$3 === null) {
        return lockedCreate(mutex$3, wasmJson$5, 16)
            .then((wasm) => {
            wasmCache$3 = wasm;
            writeSeed(seedBuffer, seedLow, seedHigh);
            wasmCache$3.writeMemory(new Uint8Array(seedBuffer));
            return wasmCache$3.calculate(data);
        });
    }
    try {
        writeSeed(seedBuffer, seedLow, seedHigh);
        wasmCache$3.writeMemory(new Uint8Array(seedBuffer));
        const hash = wasmCache$3.calculate(data);
        return Promise.resolve(hash);
    }
    catch (err) {
        return Promise.reject(err);
    }
}
/**
 * Creates a new xxHash128 hash instance
 * @param seedLow Lower 32 bits of the number used to
 *  initialize the internal state of the algorithm (defaults to 0)
 * @param seedHigh Higher 32 bits of the number used to
 *  initialize the internal state of the algorithm (defaults to 0)
 */
function createXXHash128(seedLow = 0, seedHigh = 0) {
    if (validateSeed(seedLow)) {
        return Promise.reject(validateSeed(seedLow));
    }
    if (validateSeed(seedHigh)) {
        return Promise.reject(validateSeed(seedHigh));
    }
    return WASMInterface(wasmJson$5, 16).then((wasm) => {
        const instanceBuffer = new ArrayBuffer(8);
        writeSeed(instanceBuffer, seedLow, seedHigh);
        wasm.writeMemory(new Uint8Array(instanceBuffer));
        wasm.init();
        const obj = {
            init: () => {
                wasm.writeMemory(new Uint8Array(instanceBuffer));
                wasm.init();
                return obj;
            },
            update: (data) => { wasm.update(data); return obj; },
            digest: (outputType) => wasm.digest(outputType),
            save: () => wasm.save(),
            load: (data) => { wasm.load(data); return obj; },
            blockSize: 512,
            digestSize: 16,
        };
        return obj;
    });
}

var name$4 = "ripemd160";
var data$4 = "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";
var hash$4 = "42f1de39";
var wasmJson$4 = {
	name: name$4,
	data: data$4,
	hash: hash$4
};

const mutex$2 = new Mutex();
let wasmCache$2 = null;
/**
 * Calculates RIPEMD-160 hash
 * @param data Input data (string, Buffer or TypedArray)
 * @returns Computed hash as a hexadecimal string
 */
function ripemd160(data) {
    if (wasmCache$2 === null) {
        return lockedCreate(mutex$2, wasmJson$4, 20)
            .then((wasm) => {
            wasmCache$2 = wasm;
            return wasmCache$2.calculate(data);
        });
    }
    try {
        const hash = wasmCache$2.calculate(data);
        return Promise.resolve(hash);
    }
    catch (err) {
        return Promise.reject(err);
    }
}
/**
 * Creates a new RIPEMD-160 hash instance
 */
function createRIPEMD160() {
    return WASMInterface(wasmJson$4, 20).then((wasm) => {
        wasm.init();
        const obj = {
            init: () => { wasm.init(); return obj; },
            update: (data) => { wasm.update(data); return obj; },
            digest: (outputType) => wasm.digest(outputType),
            save: () => wasm.save(),
            load: (data) => { wasm.load(data); return obj; },
            blockSize: 64,
            digestSize: 20,
        };
        return obj;
    });
}

function calculateKeyBuffer(hasher, key) {
    const { blockSize } = hasher;
    const buf = getUInt8Buffer(key);
    if (buf.length > blockSize) {
        hasher.update(buf);
        const uintArr = hasher.digest('binary');
        hasher.init();
        return uintArr;
    }
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.length);
}
function calculateHmac(hasher, key) {
    hasher.init();
    const { blockSize } = hasher;
    const keyBuf = calculateKeyBuffer(hasher, key);
    const keyBuffer = new Uint8Array(blockSize);
    keyBuffer.set(keyBuf);
    const opad = new Uint8Array(blockSize);
    for (let i = 0; i < blockSize; i++) {
        const v = keyBuffer[i];
        opad[i] = v ^ 0x5C;
        keyBuffer[i] = v ^ 0x36;
    }
    hasher.update(keyBuffer);
    const obj = {
        init: () => {
            hasher.init();
            hasher.update(keyBuffer);
            return obj;
        },
        update: (data) => {
            hasher.update(data);
            return obj;
        },
        digest: ((outputType) => {
            const uintArr = hasher.digest('binary');
            hasher.init();
            hasher.update(opad);
            hasher.update(uintArr);
            return hasher.digest(outputType);
        }),
        save: () => {
            throw new Error('save() not supported');
        },
        load: () => {
            throw new Error('load() not supported');
        },
        blockSize: hasher.blockSize,
        digestSize: hasher.digestSize,
    };
    return obj;
}
/**
 * Calculates HMAC hash
 * @param hash Hash algorithm to use. It has to be the return value of a function like createSHA1()
 * @param key Key (string, Buffer or TypedArray)
 */
function createHMAC(hash, key) {
    if (!hash || !hash.then) {
        throw new Error('Invalid hash function is provided! Usage: createHMAC(createMD5(), "key").');
    }
    return hash.then((hasher) => calculateHmac(hasher, key));
}

function calculatePBKDF2(digest, salt, iterations, hashLength, outputType) {
    return __awaiter(this, void 0, void 0, function* () {
        const DK = new Uint8Array(hashLength);
        const block1 = new Uint8Array(salt.length + 4);
        const block1View = new DataView(block1.buffer);
        const saltBuffer = getUInt8Buffer(salt);
        const saltUIntBuffer = new Uint8Array(saltBuffer.buffer, saltBuffer.byteOffset, saltBuffer.length);
        block1.set(saltUIntBuffer);
        let destPos = 0;
        const hLen = digest.digestSize;
        const l = Math.ceil(hashLength / hLen);
        let T = null;
        let U = null;
        for (let i = 1; i <= l; i++) {
            block1View.setUint32(salt.length, i);
            digest.init();
            digest.update(block1);
            T = digest.digest('binary');
            U = T.slice();
            for (let j = 1; j < iterations; j++) {
                digest.init();
                digest.update(U);
                U = digest.digest('binary');
                for (let k = 0; k < hLen; k++) {
                    T[k] ^= U[k];
                }
            }
            DK.set(T.subarray(0, hashLength - destPos), destPos);
            destPos += hLen;
        }
        if (outputType === 'binary') {
            return DK;
        }
        const digestChars = new Uint8Array(hashLength * 2);
        return getDigestHex(digestChars, DK, hashLength);
    });
}
const validateOptions$2 = (options) => {
    if (!options || typeof options !== 'object') {
        throw new Error('Invalid options parameter. It requires an object.');
    }
    if (!options.hashFunction || !options.hashFunction.then) {
        throw new Error('Invalid hash function is provided! Usage: pbkdf2("password", "salt", 1000, 32, createSHA1()).');
    }
    if (!Number.isInteger(options.iterations) || options.iterations < 1) {
        throw new Error('Iterations should be a positive number');
    }
    if (!Number.isInteger(options.hashLength) || options.hashLength < 1) {
        throw new Error('Hash length should be a positive number');
    }
    if (options.outputType === undefined) {
        options.outputType = 'hex';
    }
    if (!['hex', 'binary'].includes(options.outputType)) {
        throw new Error(`Insupported output type ${options.outputType}. Valid values: ['hex', 'binary']`);
    }
};
/**
 * Generates a new PBKDF2 hash for the supplied password
 */
function pbkdf2(options) {
    return __awaiter(this, void 0, void 0, function* () {
        validateOptions$2(options);
        const hmac = yield createHMAC(options.hashFunction, options.password);
        return calculatePBKDF2(hmac, options.salt, options.iterations, options.hashLength, options.outputType);
    });
}

var name$3 = "scrypt";
var data$3 = "AGFzbQEAAAABIwZgAX8Bf2AAAX9gBX9/fn9/AGAEf39/fwBgAX8AYAN/f38AAwcGAAECAwQFBAUBcAEBAQUGAQECgIACBggBfwFBkIgECwc5BAZtZW1vcnkCABJIYXNoX1NldE1lbW9yeVNpemUAAA5IYXNoX0dldEJ1ZmZlcgABBnNjcnlwdAAFCpcmBlsBAX9BACEBAkAgAEEAKAKACGsiAEUNAAJAIABBEHYgAEGAgHxxIABJaiIAQABBf0cNAEH/ASEBDAELQQAhAUEAQQApA4AIIABBEHStfDcDgAgLIAFBGHRBGHULagECfwJAQQAoAogIIgANAEEAPwBBEHQiADYCiAhBgIAgQQAoAoAIayIBRQ0AAkAgAUEQdiABQYCAfHEgAUlqIgBAAEF/Rw0AQQAPC0EAQQApA4AIIABBEHStfDcDgAhBACgCiAghAAsgAAu5EAMMfwl+An8gAUEFdCEFIAQgAUEIdGohBiAEIAFBB3QiB2ohCAJAAkACQAJAIAFFDQBBACEJIAAhCiAEIQsDQCALIAooAgA2AgAgCkEEaiEKIAtBBGohCyAJQQFqIgkgBUkNAAsgAlANAiABQQh0IQxBACENIAMhDgNAQQAhCSABIQ8DQCAOIAlqIgogBCAJaiILKQMANwMAIApBCGogC0EIaikDADcDACAKQRBqIAtBEGopAwA3AwAgCkEYaiALQRhqKQMANwMAIApBIGogC0EgaikDADcDACAKQShqIAtBKGopAwA3AwAgCkEwaiALQTBqKQMANwMAIApBOGogC0E4aikDADcDACAKQcAAaiALQcAAaikDADcDACAKQcgAaiALQcgAaikDADcDACAKQdAAaiALQdAAaikDADcDACAKQdgAaiALQdgAaikDADcDACAKQeAAaiALQeAAaikDADcDACAKQegAaiALQegAaikDADcDACAKQfAAaiALQfAAaikDADcDACAKQfgAaiALQfgAaikDADcDACAJQYABaiEJIA9Bf2oiDw0ACyAEIAggBiABEAMgDiEJIAQhDyABIRADQCAJIAdqIgogDyAHaiILKQMANwMAIApBCGogC0EIaikDADcDACAKQRBqIAtBEGopAwA3AwAgCkEYaiALQRhqKQMANwMAIApBIGogC0EgaikDADcDACAKQShqIAtBKGopAwA3AwAgCkEwaiALQTBqKQMANwMAIApBOGogC0E4aikDADcDACAKQcAAaiALQcAAaikDADcDACAKQcgAaiALQcgAaikDADcDACAKQdAAaiALQdAAaikDADcDACAKQdgAaiALQdgAaikDADcDACAKQeAAaiALQeAAaikDADcDACAKQegAaiALQegAaikDADcDACAKQfAAaiALQfAAaikDADcDACAKQfgAaiALQfgAaikDADcDACAJQYABaiEJIA9BgAFqIQ8gEEF/aiIQDQALIAggBCAGIAEQAyAOIAxqIQ4gDUECaiINrSACVA0ADAILCyACUA0CIAhBQGoiCikDOCERIAopAzAhEiAKKQMoIRMgCikDICEUIAopAxghFSAKKQMQIRYgCikDCCEXIAopAwAhGEECIQoDQCAKrSEZIApBAmohCiAZIAJUDQALIAYgETcDOCAGIBI3AzAgBiATNwMoIAYgFDcDICAGIBU3AxggBiAWNwMQIAYgFzcDCCAGIBg3AwALAkAgAUUNACAHQUBqIgogCGohGiACp0F/aiEOIAogBGohGyABQQd0IQ1BACEMA0AgAyANIBsoAgAgDnFsaiEHQQAhCSABIQ8DQCAEIAlqIgogCikDACAHIAlqIgspAwCFNwMAIApBCGoiECAQKQMAIAtBCGopAwCFNwMAIApBEGoiECAQKQMAIAtBEGopAwCFNwMAIApBGGoiECAQKQMAIAtBGGopAwCFNwMAIApBIGoiECAQKQMAIAtBIGopAwCFNwMAIApBKGoiECAQKQMAIAtBKGopAwCFNwMAIApBMGoiECAQKQMAIAtBMGopAwCFNwMAIApBOGoiECAQKQMAIAtBOGopAwCFNwMAIApBwABqIhAgECkDACALQcAAaikDAIU3AwAgCkHIAGoiECAQKQMAIAtByABqKQMAhTcDACAKQdAAaiIQIBApAwAgC0HQAGopAwCFNwMAIApB2ABqIhAgECkDACALQdgAaikDAIU3AwAgCkHgAGoiECAQKQMAIAtB4ABqKQMAhTcDACAKQegAaiIQIBApAwAgC0HoAGopAwCFNwMAIApB8ABqIhAgECkDACALQfAAaikDAIU3AwAgCkH4AGoiCiAKKQMAIAtB+ABqKQMAhTcDACAJQYABaiEJIA9Bf2oiDw0ACyAEIAggBiABEAMgAyANIBooAgAgDnFsaiEHQQAhCSABIQ8DQCAIIAlqIgogCikDACAHIAlqIgspAwCFNwMAIApBCGoiECAQKQMAIAtBCGopAwCFNwMAIApBEGoiECAQKQMAIAtBEGopAwCFNwMAIApBGGoiECAQKQMAIAtBGGopAwCFNwMAIApBIGoiECAQKQMAIAtBIGopAwCFNwMAIApBKGoiECAQKQMAIAtBKGopAwCFNwMAIApBMGoiECAQKQMAIAtBMGopAwCFNwMAIApBOGoiECAQKQMAIAtBOGopAwCFNwMAIApBwABqIhAgECkDACALQcAAaikDAIU3AwAgCkHIAGoiECAQKQMAIAtByABqKQMAhTcDACAKQdAAaiIQIBApAwAgC0HQAGopAwCFNwMAIApB2ABqIhAgECkDACALQdgAaikDAIU3AwAgCkHgAGoiECAQKQMAIAtB4ABqKQMAhTcDACAKQegAaiIQIBApAwAgC0HoAGopAwCFNwMAIApB8ABqIhAgECkDACALQfAAaikDAIU3AwAgCkH4AGoiCiAKKQMAIAtB+ABqKQMAhTcDACAJQYABaiEJIA9Bf2oiDw0ACyAIIAQgBiABEAMgDEECaiIMrSACVA0ADAILCyAIQUBqIgopAzghESAKKQMwIRIgCikDKCETIAopAyAhFCAKKQMYIRUgCikDECEWIAopAwghFyAKKQMAIRhBAiEKA0AgCq0hGSAKQQJqIQogGSACVA0ACyAGIBE3AzggBiASNwMwIAYgEzcDKCAGIBQ3AyAgBiAVNwMYIAYgFjcDECAGIBc3AwggBiAYNwMACyABRQ0AQQAhCgNAIAAgBCgCADYCACAAQQRqIQAgBEEEaiEEIApBAWoiCiAFSQ0ACwsL4wUDAX8IfgJ/IAIgA0EHdCAAakFAaiIEKQMAIgU3AwAgAiAEKQMIIgY3AwggAiAEKQMQIgc3AxAgAiAEKQMYIgg3AxggAiAEKQMgIgk3AyAgAiAEKQMoIgo3AyggAiAEKQMwIgs3AzAgAiAEKQM4Igw3AzgCQCADRQ0AIANBAXQhDSAAQfgAaiEEIANBBnQhDkECIQADQCACIAUgBEGIf2opAwCFNwMAIAIgBiAEQZB/aikDAIU3AwggAiAHIARBmH9qKQMAhTcDECACIAggBEGgf2opAwCFNwMYIAIgCSAEQah/aikDAIU3AyAgAiAKIARBsH9qKQMAhTcDKCACIAsgBEG4f2opAwCFNwMwIAIgDCAEQUBqKQMAhTcDOCACEAQgASACKQMANwMAIAFBCGogAikDCDcDACABQRBqIAIpAxA3AwAgAUEYaiACKQMYNwMAIAFBIGogAikDIDcDACABQShqIAIpAyg3AwAgAUEwaiACKQMwNwMAIAFBOGogAikDODcDACACIAIpAwAgBEFIaikDAIU3AwAgAiACKQMIIARBUGopAwCFNwMIIAIgAikDECAEQVhqKQMAhTcDECACIAIpAxggBEFgaikDAIU3AxggAiACKQMgIARBaGopAwCFNwMgIAIgAikDKCAEQXBqKQMAhTcDKCACIAIpAzAgBEF4aikDAIU3AzAgAiACKQM4IAQpAwCFNwM4IAIQBCABIA5qIgMgAikDADcDACADQQhqIAIpAwg3AwAgA0EQaiACKQMQNwMAIANBGGogAikDGDcDACADQSBqIAIpAyA3AwAgA0EoaiACKQMoNwMAIANBMGogAikDMDcDACADQThqIAIpAzg3AwAgACANTw0BIARBgAFqIQQgAUHAAGohASAAQQJqIQAgAikDOCEMIAIpAzAhCyACKQMoIQogAikDICEJIAIpAxghCCACKQMQIQcgAikDCCEGIAIpAwAhBQwACwsLug0IAX4BfwF+AX8BfgF/AX4SfyAAIAAoAgQgACkDKCIBQiCIpyICIAApAzgiA0IgiKciBGpBB3cgACkDCCIFQiCIp3MiBiAEakEJdyAAKQMYIgdCIIincyIIIAZqQQ13IAJzIgkgB6ciCiABpyILakEHdyADp3MiAiALakEJdyAFp3MiDCACakENdyAKcyINIAxqQRJ3IAtzIg4gACkDACIBQiCIpyIPIAApAxAiA0IgiKciEGpBB3cgACkDICIFQiCIp3MiC2pBB3dzIgogCSAIakESdyAEcyIRIAJqQQd3IAApAzAiB6ciCSABpyISakEHdyADp3MiBCASakEJdyAFp3MiEyAEakENdyAJcyIUcyIJIBFqQQl3IAsgEGpBCXcgB0IgiKdzIhVzIhYgCWpBDXcgAnMiFyAWakESdyARcyIRakEHdyAGIBQgE2pBEncgEnMiEmpBB3cgFSALakENdyAPcyIUcyICIBJqQQl3IAxzIg8gAmpBDXcgBnMiGHMiBiARakEJdyAIIA0gFCAVakESdyAQcyIQIARqQQd3cyIMIBBqQQl3cyIIcyIVIAZqQQ13IApzIhQgDCAKIA5qQQl3IBNzIhMgCmpBDXcgC3MiGSATakESdyAOcyIKakEHdyAXcyILIApqQQl3IA9zIg4gC2pBDXcgDHMiFyAOakESdyAKcyINIAIgCCAMakENdyAEcyIMIAhqQRJ3IBBzIghqQQd3IBlzIgpqQQd3cyIEIBQgFWpBEncgEXMiECALakEHdyAJIBggD2pBEncgEnMiEWpBB3cgDHMiDCARakEJdyATcyISIAxqQQ13IAlzIg9zIgkgEGpBCXcgCiAIakEJdyAWcyITcyIWIAlqQQ13IAtzIhQgFmpBEncgEHMiEGpBB3cgBiAPIBJqQRJ3IBFzIhFqQQd3IBMgCmpBDXcgAnMiC3MiAiARakEJdyAOcyIOIAJqQQ13IAZzIhhzIgYgEGpBCXcgFSAXIAsgE2pBEncgCHMiCCAMakEHd3MiCyAIakEJd3MiE3MiFSAGakENdyAEcyIXIAsgBCANakEJdyAScyISIARqQQ13IApzIhkgEmpBEncgDXMiBGpBB3cgFHMiCiAEakEJdyAOcyIPIApqQQ13IAtzIhQgD2pBEncgBHMiDSACIBMgC2pBDXcgDHMiDCATakESdyAIcyIIakEHdyAZcyILakEHd3MiBCAXIBVqQRJ3IBBzIhAgCmpBB3cgCSAYIA5qQRJ3IBFzIg5qQQd3IAxzIgwgDmpBCXcgEnMiESAMakENdyAJcyIXcyIJIBBqQQl3IAsgCGpBCXcgFnMiEnMiEyAJakENdyAKcyIYIBNqQRJ3IBBzIhBqQQd3IAYgFyARakESdyAOcyIKakEHdyASIAtqQQ13IAJzIhdzIgIgCmpBCXcgD3MiDiACakENdyAGcyIWcyIGIAkgFiAOakESdyAKcyIWakEHdyAVIBQgFyASakESdyAIcyIIIAxqQQd3cyIKIAhqQQl3cyISIApqQQ13IAxzIg9zIgwgFmpBCXcgBCANakEJdyARcyIRcyIVIAxqQQ13IAlzIhQgFWpBEncgFnMiCWpBB3cgAiAPIBJqQRJ3IAhzIghqQQd3IBEgBGpBDXcgC3MiD3MiCyAIakEJdyATcyITIAtqQQ13IAJzIhdzIhZqNgIEIAAgACgCCCAWIAlqQQl3IAogDyARakESdyANcyIRakEHdyAYcyICIBFqQQl3IA5zIg5zIg9qNgIIIAAgACgCDCAPIBZqQQ13IAZzIg1qNgIMIAAgACgCECAGIBBqQQl3IBJzIhIgDiACakENdyAKcyIYIBcgE2pBEncgCHMiCiAMakEHd3MiCCAKakEJd3MiFiAIakENdyAMcyIMajYCECAAIAAoAgAgDSAPakESdyAJc2o2AgAgACAAKAIUIAwgFmpBEncgCnNqNgIUIAAgACgCGCAIajYCGCAAIAAoAhwgFmo2AhwgACAAKAIgIBIgBmpBDXcgBHMiCSAYIA5qQRJ3IBFzIgYgC2pBB3dzIgogBmpBCXcgFXMiBGo2AiAgACAAKAIkIAQgCmpBDXcgC3MiC2o2AiQgACAAKAIoIAsgBGpBEncgBnNqNgIoIAAgACgCLCAKajYCLCAAIAAoAjAgCSASakESdyAQcyIGIAJqQQd3IBRzIgtqNgIwIAAgACgCNCALIAZqQQl3IBNzIgpqNgI0IAAgACgCOCAKIAtqQQ13IAJzIgJqNgI4IAAgACgCPCACIApqQRJ3IAZzajYCPAtyAwF/AX4CfwJAIAJFDQBBACgCiAgiAyAAIAGtIgQgAyAAQQd0IgUgAmxqIgMgAyAFIAFsaiIGEAIgAkEBRg0AIAJBf2ohASAFIQIDQEEAKAKICCACaiAAIAQgAyAGEAIgAiAFaiECIAFBf2oiAQ0ACwsL";
var hash$3 = "d96fb75f";
var wasmJson$3 = {
	name: name$3,
	data: data$3,
	hash: hash$3
};

function scryptInternal(options) {
    return __awaiter(this, void 0, void 0, function* () {
        const { costFactor, blockSize, parallelism, hashLength, } = options;
        const SHA256Hasher = createSHA256();
        const blockData = yield pbkdf2({
            password: options.password,
            salt: options.salt,
            iterations: 1,
            hashLength: 128 * blockSize * parallelism,
            hashFunction: SHA256Hasher,
            outputType: 'binary',
        });
        const scryptInterface = yield WASMInterface(wasmJson$3, 0);
        // last block is for storing the temporary vectors
        const VSize = 128 * blockSize * costFactor;
        const XYSize = 256 * blockSize;
        scryptInterface.setMemorySize(blockData.length + VSize + XYSize);
        scryptInterface.writeMemory(blockData, 0);
        // mix blocks
        scryptInterface.getExports().scrypt(blockSize, costFactor, parallelism);
        const expensiveSalt = scryptInterface
            .getMemory()
            .subarray(0, 128 * blockSize * parallelism);
        const outputData = yield pbkdf2({
            password: options.password,
            salt: expensiveSalt,
            iterations: 1,
            hashLength,
            hashFunction: SHA256Hasher,
            outputType: 'binary',
        });
        if (options.outputType === 'hex') {
            const digestChars = new Uint8Array(hashLength * 2);
            return getDigestHex(digestChars, outputData, hashLength);
        }
        // return binary format
        return outputData;
    });
}
// eslint-disable-next-line no-bitwise
const isPowerOfTwo = (v) => v && !(v & (v - 1));
const validateOptions$1 = (options) => {
    if (!options || typeof options !== 'object') {
        throw new Error('Invalid options parameter. It requires an object.');
    }
    if (!Number.isInteger(options.blockSize) || options.blockSize < 1) {
        throw new Error('Block size should be a positive number');
    }
    if (!Number.isInteger(options.costFactor)
        || options.costFactor < 2
        || !isPowerOfTwo(options.costFactor)) {
        throw new Error('Cost factor should be a power of 2, greater than 1');
    }
    if (!Number.isInteger(options.parallelism) || options.parallelism < 1) {
        throw new Error('Parallelism should be a positive number');
    }
    if (!Number.isInteger(options.hashLength) || options.hashLength < 1) {
        throw new Error('Hash length should be a positive number.');
    }
    if (options.outputType === undefined) {
        options.outputType = 'hex';
    }
    if (!['hex', 'binary'].includes(options.outputType)) {
        throw new Error(`Insupported output type ${options.outputType}. Valid values: ['hex', 'binary']`);
    }
};
/**
 * Calculates hash using the scrypt password-based key derivation function
 * @returns Computed hash as a hexadecimal string or as
 *          Uint8Array depending on the outputType option
 */
function scrypt(options) {
    return __awaiter(this, void 0, void 0, function* () {
        validateOptions$1(options);
        return scryptInternal(options);
    });
}

var name$2 = "bcrypt";
var data$2 = "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";
var hash$2 = "9f4c7b9e";
var wasmJson$2 = {
	name: name$2,
	data: data$2,
	hash: hash$2
};

function bcryptInternal(options) {
    return __awaiter(this, void 0, void 0, function* () {
        const { costFactor, password, salt } = options;
        const bcryptInterface = yield WASMInterface(wasmJson$2, 0);
        bcryptInterface.writeMemory(getUInt8Buffer(salt), 0);
        const passwordBuffer = getUInt8Buffer(password);
        bcryptInterface.writeMemory(passwordBuffer, 16);
        const shouldEncode = options.outputType === 'encoded' ? 1 : 0;
        bcryptInterface.getExports().bcrypt(passwordBuffer.length, costFactor, shouldEncode);
        const memory = bcryptInterface.getMemory();
        if (options.outputType === 'encoded') {
            return intArrayToString(memory, 60);
        }
        if (options.outputType === 'hex') {
            const digestChars = new Uint8Array(24 * 2);
            return getDigestHex(digestChars, memory, 24);
        }
        // return binary format
        // the data is copied to allow GC of the original memory buffer
        return memory.slice(0, 24);
    });
}
const validateOptions = (options) => {
    if (!options || typeof options !== 'object') {
        throw new Error('Invalid options parameter. It requires an object.');
    }
    if (!Number.isInteger(options.costFactor) || options.costFactor < 4 || options.costFactor > 31) {
        throw new Error('Cost factor should be a number between 4 and 31');
    }
    options.password = getUInt8Buffer(options.password);
    if (options.password.length < 1) {
        throw new Error('Password should be at least 1 byte long');
    }
    if (options.password.length > 72) {
        throw new Error('Password should be at most 72 bytes long');
    }
    options.salt = getUInt8Buffer(options.salt);
    if (options.salt.length !== 16) {
        throw new Error('Salt should be 16 bytes long');
    }
    if (options.outputType === undefined) {
        options.outputType = 'encoded';
    }
    if (!['hex', 'binary', 'encoded'].includes(options.outputType)) {
        throw new Error(`Insupported output type ${options.outputType}. Valid values: ['hex', 'binary', 'encoded']`);
    }
};
/**
 * Calculates hash using the bcrypt password-hashing function
 * @returns Computed hash
 */
function bcrypt(options) {
    return __awaiter(this, void 0, void 0, function* () {
        validateOptions(options);
        return bcryptInternal(options);
    });
}
const validateHashCharacters = (hash) => {
    if (!/^\$2[axyb]\$[0-3][0-9]\$[./A-Za-z0-9]{53}$/.test(hash)) {
        return false;
    }
    if (hash[4] === '0' && parseInt(hash[5], 10) < 4) {
        return false;
    }
    if (hash[4] === '3' && parseInt(hash[5], 10) > 1) {
        return false;
    }
    return true;
};
const validateVerifyOptions = (options) => {
    if (!options || typeof options !== 'object') {
        throw new Error('Invalid options parameter. It requires an object.');
    }
    if (options.hash === undefined || typeof options.hash !== 'string') {
        throw new Error('Hash should be specified');
    }
    if (options.hash.length !== 60) {
        throw new Error('Hash should be 60 bytes long');
    }
    if (!validateHashCharacters(options.hash)) {
        throw new Error('Invalid hash');
    }
    options.password = getUInt8Buffer(options.password);
    if (options.password.length < 1) {
        throw new Error('Password should be at least 1 byte long');
    }
    if (options.password.length > 72) {
        throw new Error('Password should be at most 72 bytes long');
    }
};
/**
 * Verifies password using bcrypt password-hashing function
 * @returns True if the encoded hash matches the password
 */
function bcryptVerify(options) {
    return __awaiter(this, void 0, void 0, function* () {
        validateVerifyOptions(options);
        const { hash, password } = options;
        const bcryptInterface = yield WASMInterface(wasmJson$2, 0);
        bcryptInterface.writeMemory(getUInt8Buffer(hash), 0);
        const passwordBuffer = getUInt8Buffer(password);
        bcryptInterface.writeMemory(passwordBuffer, 60);
        return !!bcryptInterface.getExports().bcrypt_verify(passwordBuffer.length);
    });
}

var name$1 = "whirlpool";
var data$1 = "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";
var hash$1 = "358808f8";
var wasmJson$1 = {
	name: name$1,
	data: data$1,
	hash: hash$1
};

const mutex$1 = new Mutex();
let wasmCache$1 = null;
/**
 * Calculates Whirlpool hash
 * @param data Input data (string, Buffer or TypedArray)
 * @returns Computed hash as a hexadecimal string
 */
function whirlpool(data) {
    if (wasmCache$1 === null) {
        return lockedCreate(mutex$1, wasmJson$1, 64)
            .then((wasm) => {
            wasmCache$1 = wasm;
            return wasmCache$1.calculate(data);
        });
    }
    try {
        const hash = wasmCache$1.calculate(data);
        return Promise.resolve(hash);
    }
    catch (err) {
        return Promise.reject(err);
    }
}
/**
 * Creates a new Whirlpool hash instance
 */
function createWhirlpool() {
    return WASMInterface(wasmJson$1, 64).then((wasm) => {
        wasm.init();
        const obj = {
            init: () => { wasm.init(); return obj; },
            update: (data) => { wasm.update(data); return obj; },
            digest: (outputType) => wasm.digest(outputType),
            save: () => wasm.save(),
            load: (data) => { wasm.load(data); return obj; },
            blockSize: 64,
            digestSize: 64,
        };
        return obj;
    });
}

var name = "sm3";
var data = "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";
var hash = "6e6f46ad";
var wasmJson = {
	name: name,
	data: data,
	hash: hash
};

const mutex = new Mutex();
let wasmCache = null;
/**
 * Calculates SM3 hash
 * @param data Input data (string, Buffer or TypedArray)
 * @returns Computed hash as a hexadecimal string
 */
function sm3(data) {
    if (wasmCache === null) {
        return lockedCreate(mutex, wasmJson, 32)
            .then((wasm) => {
            wasmCache = wasm;
            return wasmCache.calculate(data);
        });
    }
    try {
        const hash = wasmCache.calculate(data);
        return Promise.resolve(hash);
    }
    catch (err) {
        return Promise.reject(err);
    }
}
/**
 * Creates a new SM3 hash instance
 */
function createSM3() {
    return WASMInterface(wasmJson, 32).then((wasm) => {
        wasm.init();
        const obj = {
            init: () => { wasm.init(); return obj; },
            update: (data) => { wasm.update(data); return obj; },
            digest: (outputType) => wasm.digest(outputType),
            save: () => wasm.save(),
            load: (data) => { wasm.load(data); return obj; },
            blockSize: 64,
            digestSize: 32,
        };
        return obj;
    });
}

export { adler32, argon2Verify, argon2d, argon2i, argon2id, bcrypt, bcryptVerify, blake2b, blake2s, blake3, crc32, crc32c, createAdler32, createBLAKE2b, createBLAKE2s, createBLAKE3, createCRC32, createCRC32C, createHMAC, createKeccak, createMD4, createMD5, createRIPEMD160, createSHA1, createSHA224, createSHA256, createSHA3, createSHA384, createSHA512, createSM3, createWhirlpool, createXXHash128, createXXHash3, createXXHash32, createXXHash64, keccak, md4, md5, pbkdf2, ripemd160, scrypt, sha1, sha224, sha256, sha3, sha384, sha512, sm3, whirlpool, xxhash128, xxhash3, xxhash32, xxhash64 };
