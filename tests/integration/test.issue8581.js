describe('test.issue8581.js', function () {
  let iframe;
  let callbackFnName = "";
  afterEach(() => {
    if (iframe) {
      document.body.removeChild(iframe);
    }
    iframe = null;
    delete window[callbackFnName];
  });

  it('Should not raise error', async function () {
    callbackFnName = "callback" + Date.now();
    const okPromise = new Promise((res) => {
      window[callbackFnName] = () => {
        delete window[callbackFnName];
        res();
      };
    });
    iframe = document.createElement("iframe");
    iframe.src = "about:blank";
    document.body.appendChild(iframe);
    const target = iframe.contentDocument;
    const scriptElement = target.createElement("script");
    scriptElement.innerHTML = `localStorage.setItem("Hello",new Date());
requestIdleCallback(()=>window.parent.${callbackFnName}(),{timeout:100});`;
    target.body.appendChild(scriptElement);
    await Promise.race([okPromise, new Promise(res => setTimeout(res, 250))]);
  });
});