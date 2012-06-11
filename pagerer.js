(function ($) {

Drupal.pagerer = {};

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
          Drupal.pagerer.relocate(state.root, state.path.replace(/pagererpage/, page));
          e.preventDefault();
          return false;
        case 38:    // up key
          Drupal.pagerer.pageStep(this, state, -1);
          return true;
        case 40:    // down key
          Drupal.pagerer.pageStep(this, state, 1);
          return true;
        case 33:    // page up
          Drupal.pagerer.pageStep(this, state, -5);
          return true;
        case 34:    // page down
          Drupal.pagerer.pageStep(this, state, 5);
          return true;
      }
    });

    // pagerer-slider event binding
    $('.pagerer-slider', context)
    .bind('slidecreate', function(e, ui) {
      var state = eval('(' + $(this).attr('id') + ');');
      var sliderBar = $(this);
      var sliderHandle = $(this).find(".ui-slider-handle")
      sliderHandle
        .width(String(state.total).length + 'em')
        .css('line-height', sliderHandle.height() + 'px')
        .css('margin-left', -sliderHandle.width() / 2)
        .bind('blur', function(e) {
          var xPage = $(this).parent().slider("option", "value") - 1;
          Drupal.pagerer.relocate(state.root, state.path.replace(/pagererpage/, xPage));
//          alert('slider blur ' + xxx);
        });
      sliderBar
        .slider("option", "max", state.total)
        .slider("option", "value", state.current)
        .width((state.quantity * 3) + 'em')
        .css('margin-left', sliderHandle.width() / 2)
        .css('margin-right', sliderHandle.width() / 2);
    })
    .bind('slide', function(e, ui) {
      $(this).find(".ui-slider-handle").text(ui.value);
    })
    .bind('slidechange', function(e, ui) {
      $(this).find(".ui-slider-handle").text(ui.value);
    });


    function offsetSliderValue(ui, offset) {
      var newValue = ui.slider("option", "value") + offset;
      var maxValue = ui.slider("option", "max");
      if (newValue > 0 && newValue <= maxValue) {
        ui.slider("option", "value", newValue);
      }
    }

    var timeoutId = 0;
    var idlecycles = 0;

    $('.ui-icon-circle-minus', context)
    .bind('mousedown', function(e) {
      var pSlider = $(this).parent().parent().find('.pagerer-slider');
      offsetSliderValue(pSlider, -1);
      timeoutId = setInterval(function(){
        idlecycles++;
        if (idlecycles > 10) {
          offsetSliderValue(pSlider, -1);
        }
      }, 50);
    })
    .bind('mouseup mouseleave', function() {
      var pSlider = $(this).parent().parent().find('.pagerer-slider');
      idlecycles = 0;
      clearInterval(timeoutId);
      pSlider.find(".ui-slider-handle").focus();
    });

    $('.ui-icon-circle-plus', context)
    .bind('mousedown', function(e) {
      var pSlider = $(this).parent().parent().find('.pagerer-slider');
      var state = eval('(' + pSlider.attr('id') + ');');
      offsetSliderValue(pSlider, 1);
      timeoutId = setInterval(function(){
        idlecycles++;
        if (idlecycles > 10) {
          offsetSliderValue(pSlider, 1);
        }
      }, 50);
    })
    .bind('mouseup mouseleave', function() {
      var pSlider = $(this).parent().parent().find('.pagerer-slider');
      idlecycles = 0;
      clearInterval(timeoutId);
      pSlider.find(".ui-slider-handle").focus();
    });

  }
};

Drupal.pagerer.pageStep = function(el, state, step) {
  var page = isNaN($(el).val()) ? 1 : parseInt($(el).val());
  page += step * state.interval;
  if (page < 1) {
    page = 1;
  } else if (page > state.total){
    page = state.total;
  }
  $(el).val(page);
};

Drupal.pagerer.relocate = function (root, path) {
  if (window.Drupal.overlayChild) {
    // Drupal admin overlay
    window.parent.jQuery.bbq.pushState({'overlay': path});
  } else {
    // Normal page
    document.location = root + path;
  }
};



})(jQuery);
