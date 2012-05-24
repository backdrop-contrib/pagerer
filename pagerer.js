(function ($) {

Drupal.Pagerer = {};

Drupal.behaviors.pagerer = {
  attach: function(context, settings) {

    // document ready
    $(document).ready(function(){

      // adjust all the widths of pagerer-page to corresponding max
      // width expected
      $('.pagerer-page').each(function(index) {
        var state = eval('(' + $(this).attr('name') + ');');
        $(this).width(String(state.total).length + 'em');
      });

      // initiate slider
      $('.pagerer-slider').each(function(index) {
        $(this).slider({ min : 1, step : 1, range : 'min', animate: true });
      });

    });

    // pagerer-page event binding
    $(".pagerer-page", context)
    .bind('focus', function(e) {
      this.select();
      $(this).addClass('pagerer-page-has-focus');
    })
    .bind('blur', function(e) {
      $(this).removeClass('pagerer-page-has-focus');
    })
    .bind('keydown', function(e) {
      var state = eval('(' + $(this).attr('name') + ');');
      switch(e.keyCode) {
        case 13:
        case 10:   // iPhone <return>
          if (state.display == 'pages') {
            var page = isNaN($(this).val()) ? 0 : parseInt($(this).val()) - 1;
            if (page < 0) {
              page = 0;
            } else if (page >= state.total) {
              page = state.total - 1;
            }
          } else {
            var item = isNaN($(this).val()) ? 0 : parseInt($(this).val()) - 1;
            if (item < 0) {
              item = 0;
            } else if (item >= state.total) {
              item = state.total - 1;
            }
            page = parseInt(item / parseInt(state.interval));
          }
          if (window.Drupal.overlayChild) {    // Drupal admin overlay
            window.parent.jQuery.bbq.pushState({'overlay': state.path.replace(/pagererpage/, page)});
          } else {                    // Normal page
            document.location = state.root + state.path.replace(/pagererpage/, page);
          }
          e.preventDefault();
          return false;
        case 38:    // up key
          Drupal.Pagerer.pageStep(this, state, -1);
          return true;
        case 40:    // down key
          Drupal.Pagerer.pageStep(this, state, 1);
          return true;
        case 33:    // page up
          Drupal.Pagerer.pageStep(this, state, -5);
          return true;
        case 34:    // page down
          Drupal.Pagerer.pageStep(this, state, 5);
          return true;
      }
    });

    // slider event binding
    $('.pagerer-slider', context)
    .bind('slidecreate', function(e, ui) {
      var sliderHeight = $(this).height();
      //alert(sliderHeight);
      var state = eval('(' + $(this).attr('id') + ');');
      $(this).slider("option", "max", state.total);
      $(this).slider("option", "value", state.current);
      var handleEmWidth = String(state.total).length;
      var sliderHandle = $(this).find(".ui-slider-handle");
      //sliderHandle.css('top', '-2em');
      sliderHandle.css('top', '-4px');
      sliderHandle.height((sliderHeight + 6) + 'px');
      sliderHandle.width(handleEmWidth + 'em');
      $(this).css('margin-left', sliderHandle.width() / 2);
      $(this).css('margin-right', sliderHandle.width() / 2);
      sliderHandle.css('margin-left', -sliderHandle.width() / 2);
      sliderHandle.css('text-align', 'center');
      sliderHandle.css('line-height', sliderHandle.height() + 'px');
      //alert(sliderHandle.height());
      //$(this).find(".ui-slider-handle").append("<span class='mytext'>xxx</span>" );
    })
    .bind('slide', function(e, ui) {
      $(this).find(".ui-slider-handle").text(ui.value);
    })
    .bind('slidechange', function(e, ui) {
      $(this).find(".ui-slider-handle").text(ui.value);
    })
  }
};

Drupal.Pagerer.pageStep = function(el, state, step) {
  var page = isNaN($(el).val()) ? 1 : parseInt($(el).val());
  page += step * state.interval;
  if (page < 1) {
    page = 1;
  } else if (page > state.total){
    page = state.total;
  }
  $(el).val(page);
};

})(jQuery);
