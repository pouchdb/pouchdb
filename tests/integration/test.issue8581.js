'use strict';

if (typeof window !== "undefined" && typeof window.document !== 'undefined') {
  runTests();
}

function runTests() {
  describe('test.issue8581.js', function () {
    let iframe;
    let callbackFnName = "";
    afterEach(() => {
      if (iframe) {
        window.document.body.removeChild(iframe);
      }
      iframe = null;
      if (callbackFnName in window) {
        delete window[callbackFnName];
      }
    });
    this.beforeEach(() => {
      callbackFnName = "callback" + Date.now();
      iframe = window.document.createElement("iframe", { src: "about:blank" });
      window.document.body.appendChild(iframe);
    });

    it('#8581 Should not raise error', function (done) {
      window[callbackFnName] = (err) => {
        if (timeout) {
          timeout = clearTimeout(timeout);
        }
        done(err);
        window[callbackFnName] = () => { };
      };
      let timeout = setTimeout(
        () => {
          if (callbackFnName in window) {
            window[callbackFnName](new Error(`Timed out`));
          }
        }
        , 500);
      const target = iframe.contentDocument;
      const scriptElement = target.createElement("script");
      scriptElement.innerHTML =
        `localStorage.setItem("Hello",new Date());setTimeout(window.parent.${callbackFnName},100);`;
      target.body.appendChild(scriptElement);
    });
  });
}