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

function lockedCreate(mutex, binary, hashLength) {
    return __awaiter(this, void 0, void 0, function* () {
        const unlock = yield mutex.lock();
        const wasm = yield WASMInterface(binary, hashLength);
        unlock();
        return wasm;
    });
}

new Mutex();

new Mutex();

new Mutex();

new Mutex();

new Mutex();

new Mutex();

new Mutex();

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

new Mutex();

new Mutex();

new Mutex();

new Mutex();

new Mutex();

new Mutex();

new Mutex();

new Mutex();

new Mutex();

new Mutex();

new Mutex();

new Mutex();

new Mutex();

new Mutex();

export { md5 };
