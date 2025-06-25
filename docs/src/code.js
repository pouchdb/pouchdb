function codeWrap(){
  "use strict";

  var DEFAULT_TYPE = 'promise';

  var $codes = $('[data-code-id]').get();

  var codeIds =
    $codes
      .map(function(div){
          return div.attributes["data-code-id"].value
      })
      .filter(function(item, index, inputArray){
          // Each code block has multiple versions so let's only grab one.
          return inputArray.indexOf(item) == index;
      });

  wrap();
  setAll();

  $('[data-code-tablist] [href]').on('click', function(e){
    var href = $(this).attr('href');

    setAll(href.replace('#', ''));

    setEqualHeights();

    e.preventDefault();
  });

  function wrap(){
    var codeTpl = '' +
      '<ul class="nav nav-tabs nav-code" data-code-tablist="{{codeId}}">' +
        '<li>' +
            '<a href="#async">Async functions</a>' +
        '</li>' +
        '<li class="active">' +
            '<a href="#promise">Promises</a>' +
        '</li>' +
        '<li>' +
            '<a href="#callback">Callbacks</a>' +
        '</li>' +
      '</ul>' +
      '<div class="tab-content">{{tapPanes}}</div>';
    codeIds
      .forEach(function(id){
        var $code = $("[data-code-id='" + id + "']");

        var paneHtml = $code.get().map(function(div){
          return div.outerHTML;
        }).join('');

        var codeHtml = codeTpl
                          .replace(/{{tapPanes}}/g, paneHtml)
                          .replace(/{{codeId}}/g, id);
        $code
          .first()
          .replaceWith(codeHtml);
        $code.remove();
      });
    // Remove items that are only useful for non-JS users.
    $('[data-code-hide]').addClass('hide');
  }

  function setAll(type){

    // We default to callback so no need to do anything the first time.
    var firstTime = !localStorage.getItem('codeStyle');
    if(firstTime){
      localStorage.setItem('codeStyle', DEFAULT_TYPE);
    }

    type = type || localStorage.getItem('codeStyle');
    if(typeof type === "undefined" || type === null) {
      return;
    }

    var $tablist = $('[data-code-tablist] [href="#' + type + '"]').parent();
    $('[data-code-tablist] li').removeClass('active');
    $tablist.addClass('active');

    $('.tab-pane').removeClass('active');
    $('.tab-pane[id="' + type + '"]').addClass('active');
    localStorage.setItem('codeStyle', type);
  }


  var setHeights = [];
  function setEqualHeights(){
    if(setHeights.length > 0){
      return;
    }
    codeIds
      .forEach(function(id){
        var $code = $("[data-code-id='" + id + "']");

        var paneHeight = 0;

        $code.get().forEach(function(div){
          var originalDisplay = div.style.display;
          div.style.display = 'block';
          var clientHeight = div.clientHeight;
          div.style.display = originalDisplay;
          if(clientHeight > paneHeight){
            paneHeight = clientHeight;
          }
        });
        $code.find('pre').css('height', paneHeight);
        setHeights.push(id);
      });
  }
}
codeWrap();

function addCodeCopyButtons() {
  if (!navigator.clipboard.writeText) return;

  function copyCodeFor(codeElement) {
    return () => {
      navigator.clipboard.writeText(codeElement.textContent);

      const success = addButton('✅', codeElement);
      success.disabled = true;
      success.style.transition = 'opacity 1.5s ease';
      setTimeout(() => {
        success.style.opacity = 0;
        setTimeout(() => codeElement.removeChild(success), 1500);
      }, 500);
    };
  }

  function addButton(txt, parent) {
    const btn = document.createElement('button');
    btn.style.position = 'absolute';
    btn.style.top   = '11.5px';
    btn.style.right = '15px';
    btn.textContent = txt;

    parent.appendChild(btn);

    return btn;
  }

  document
    .querySelectorAll('code[data-lang]')
    .forEach(codeElement => {
      codeElement.parentElement.style.position = 'relative';

      const btn = addButton('📎', codeElement);
      btn.onclick = copyCodeFor(codeElement);
    });
}
addCodeCopyButtons();
