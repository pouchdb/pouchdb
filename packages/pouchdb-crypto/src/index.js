/* eslint-disable no-undef */

// Hashing Checksums and more

// Todo: crypto api useage must be async browser api is async and hash-wasm is async
// Todo: we should use hash-wasm md5 only at present and use where supported
// nodejs / browser(secure context only) 
//       const { subtle } = globalThis.crypto;
// Importing only usefull methods that are not included in globalThis.crypto.subtle
import { md5 } from 'hash-wasm';

export {
    blake3,
    blake2s,
    blake2b,
    md5,
    createMD5,
    createBLAKE3,
    createBLAKE2s,
    createBLAKE2b,
} from 'hash-wasm';
//import { md5, sha1, sha512, sha3 } from 'hash-wasm'
// replaces stringMd5 returns hex should also use message.normalize('NFKC')
export const createoldMD5 = async (message="") => md5(new TextEncoder().encode(message));
/** @type {(x:string)=>"hexString"} */
export const stringMd5 = async (message="") => md5(message);


// used by hash-wasm to convert digest: hex to Response(arrayBuffer)
// Note that hex is a text representation of bytes like base64
// Note that UTF-8 Strings can get turned into hex and base64
// Note base64 is only usefull in URLS json supports hex strings
export const hex2arrayBuffer = (hex="") => new Uint8Array(hex.match(
    /../g).map(h=>parseInt(h,16))).buffer;
/** @type {(x:string)=>string} */
export const hex2utf16 = (hex="") => hex.match(
    /\w{2}/g).map(b=>String.fromCharCode(parseInt(b, 16))).join("");
const btoa = globalThis.btoa ? (str="") => globalThis.btoa(str) : globalThis.Buffer && ((string) => globalThis.Buffer.from(string).toString('base64'));
export const hex2base64 = (hex="") => btoa(hex2utf16(hex));

export async function binaryMd5(data, callback=()=>{}) {
    // var base64 = crypto.createHash('md5').update(data, 'binary').digest('base64');
    // callback(base64);
    return md5(data).then(btoa).then((base64)=>[callback(base64)] && base64);
}

export async function digestFromMessage(message,algo='SHA-256') {
    const msgUint8 = new TextEncoder().encode(message);
    const arrayBuffer = await crypto.subtle.digest(algo, msgUint8); // hash the message
        
    return { 
        digist(format='hex') {
            const formats = {
                hex: () => 
                Array.from(new Uint8Array(arrayBuffer))
                // converted buffer to byte array
                .map((b) => b.toString(16).padStart(2, "0"))
                .join(""), // converted bytes to hex string;
            };
            // Fails by design with wrong format            
            return formats[format]();
        } 
    };
}



// Enables binary raw fetch eliminates the need for ascii conversation
// eliminates the need for base64 
const charset = 'x-user-defined';

// Maps to the UTF Private Address Space Area so you can get bits as chars
const binaryRawEnablingHeader = `text/plain; charset=${charset}`;

// UNICODE Private Area 0xF700-0xF7ff.
const convertToAbyte = (chars) => 
  new Array(chars.length)
    .map((_abyte,offset) => chars.charCodeAt(offset) & 0xff);

// supports   'range': 'bytes=2-5,10-13'
export const _BinaryRawFetch = (url) => fetch(url,{ headers: { 
  'Content-Type': binaryRawEnablingHeader,
}}).then(
    (res) => convertToAbyte(res.text())
);

export const base64encoderStream = {
    transform(data,ready) {
        let reader = new FileReader();        
        reader.onloadend = () => {
            ready.enqueue(reader.result.split(';base64,',1));
            reader = null;
        };
        reader.readAsDataURL(new Blob(data));
    }
};

//new TransformStream(base64encoderStream)

// Old But gold
export function blobToBase64(blobOrBuffer, callback) {
    new Response(blobOrBuffer).arrayBuffer().then((arrayBuffer) => btoa(
    String.fromCharCode(
    ...new Uint8Array(arrayBuffer)
    ))).then((b64)=>callback(null,b64),err=>callback(err));
   //callback(blobOrBuffer.toString('binary'));
}
// eg "digest":"md5-yDbs1scfYdqqLpxyFb1gFw==",
// base642hex new Buffer('yDbs1scfYdqqLpxyFb1gFw==', 'base64').toString('hex')
// hex2base64 new Buffer('c836ecd6c71f61daaa2e9c7215bd6017', 'hex').toString('base64')

// Node does not even support the fileReader Api 
// Returns only the ${base64Data} 
// Reverse: await fetch(`data:${'image/jpeg'||''};base64,${base64Data}`);
export const toBase64 = (blob) => new Promise((resolve, reject) => {
    const reader = new FileReader;
    reader.onerror = reject;
    reader.onload = () => {
        resolve(reader.result.split('base64,',1)[1]);
    };
    reader.readAsDataURL(new Blob([].concat(blob)));
});




// Development notes
// Todo: Improve base64 use maybe deprecate it complet in favor of nativ UTF8 PrivateArea
// Todo: Improve Linking refactor to use pouchdb-lib/src/index.js pouchdb_package_name
// Todo: we should stay with atob for browsers and btoa Buffer.string('base64') for node

// Todo: node buffer should only get used in the edge case of base64
