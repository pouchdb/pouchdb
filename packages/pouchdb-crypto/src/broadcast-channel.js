/* eslint-disable no-undef */
var channels = [];
// MessagePorts are Supported in Node 15.x
class BroadcastChannel {
    constructor(channel="") {
        this._name = channel;
        this._id = `$BroadcastChannel$${channel}$`;
        channels[this._id] = channels[this._id] || [];
        channels[this._id].push(this);
        
        this._closed = false;
        this._mc = new MessageChannel();
        this._mc.port1.start();
        this._mc.port2.start();
        // Routing via net.socket
        // Routing via localStroage events
        // globalThis.addEventListener('storage', (e) => {
        //     if (e.storageArea !== global.localStorage) return;
        //     if (e.newValue === null) return;
        //     if (e.key.substring(0, id.length) !== id) return;
        //     var data = JSON.parse(e.newValue);
        //     this._mc.port2.postMessage(data);
        // });
    }
    // BroadcastChannel API
    get name() { return this._name; }
    postMessage(message) {
        
        if (this._closed) {
            throw Object.assign(
                new Error(),{name:'InvalidStateError'}
            );
        }
        const value = JSON.stringify(message);
        
        // Routing via net.socket

        // Broadcast to other contexts via storage events...
        // const key = this._id + String(Date.now()) + '$' + String(Math.random());
        // global.localStorage.setItem(key, value);
        // setTimeout(function() { global.localStorage.removeItem(key); }, 500);

        // Broadcast to current context via ports
        channels[this._id].forEach((bC) => {
            bC !== this && bC._mc.port2.postMessage(JSON.parse(value));
        });
    }
    close() {
        if (this._closed) {return;}
        this._closed = true;
        this._mc.port1.close();
        this._mc.port2.close();

        var index = channels[this._id].indexOf(this);
        channels[this._id].splice(index, 1);
    }

    // EventTarget API
    get onmessage() { return this._mc.port1.onmessage; }
    set onmessage(value) { this._mc.port1.onmessage = value; }
    addEventListener(type, listener /*, useCapture*/) {
        return this._mc.port1.addEventListener.apply(this._mc.port1, type,listener);
    }
    removeEventListener(type, listener /*, useCapture*/) {
        return this._mc.port1.removeEventListener.apply(this._mc.port1, type,listener);
    }
    dispatchEvent(event) {
        return this._mc.port1.dispatchEvent.apply(this._mc.port1, event);
    }
}

// NodeJS 15.x Supports MessageChannel v18 Broadcast Channel
const implementation = globalThis.BroadcastChannel || BroadcastChannel;

export { implementation as BroadcastChannel };