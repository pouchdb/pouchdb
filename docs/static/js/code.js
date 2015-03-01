function codeWrap(){    
  var codeTpl = '' +
  '<ul class="nav nav-tabs nav-code" data-code-tablist>' +
    '<li class="active">' +
        '<a href="#promise">Promises</a>' +
    '</li>' +
    '<li>' +
        '<a href="#callback">Callbacks</a>' +
    '</li>' +
  '</ul>' +
  '<div class="tab-content">{{tapPanes}}</div>';

  var codeGroups =
    $('[data-code-id]')
      .get()
      .map(function(div){
          return div.attributes["data-code-id"].value
      })
      .filter(function(item, index, inputArray){
          return inputArray.indexOf(item) == index;
      })
      .forEach(function(id){
        var $code = $("[data-code-id='" + id + "']");

        var paneHeight = 0;

        var paneHtml = $code.get().map(function(div){
          if(div.clientHeight > paneHeight){
            paneHeight = div.clientHeight;
          }
          return div.outerHTML;
        }).join('');

        // Pad the pane height
        paneHeight = paneHeight + 15;

        var codeHtml = codeTpl
                         .replace(/{{tapPanes}}/g, paneHtml)
                         .replace(/<pre>/g, "<pre style='height: " + paneHeight + "px;'");

        $code
          .first()
          .replaceWith(codeHtml);
        $code.remove();

        // Remove items that are only useful for non-JS users.
        $('[data-code-hide]').addClass('hide');
      });

  $('[data-code-tablist] [href]').on('click', function(e){
    var href = $(this).attr('href');

    setAll(href.replace('#', ''));

    e.preventDefault();
  });

  function setAll(type){
    var type = type || localStorage.getItem('codeStyle');
    if(typeof type === "undefined" || type === null) return;

    $('[data-code-tablist] li, .tab-pane').removeClass('active');
    $('[data-code-tablist] [href="#' + type + '"]').parent().addClass('active');
    $('.tab-pane[id="' + type + '"]').addClass('active');
    localStorage.setItem('codeStyle', type);
  }

  setAll();
};
codeWrap();
