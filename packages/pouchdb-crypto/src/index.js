/* eslint-disable no-undef */

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

// used by hash-wasm to convert digest: hex to Response(arrayBuffer)
export const hex2arrayBuffer = (hex="") => new Uint8Array(hex.match(/../g).map(h=>parseInt(h,16))).buffer;

const btoa = (globalThis.btoa) || globalThis.Buffer && ((string) => globalThis.Buffer.from(string).toString('base64'));

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


//import { md5, sha1, sha512, sha3 } from 'hash-wasm'
// replaces stringMd5 returns hex should also use message.normalize('NFKC')
export const createoldMD5 = (message="") => import('hash-wasm').then(({ md5 }) => md5(
    new TextEncoder().encode(message)
));
export const stringMd5 = async (message="") => (await import('hash-wasm')).md5(message);