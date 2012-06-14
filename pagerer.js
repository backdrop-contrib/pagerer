/**
 * @file
 *
 * Pagerer jquery scripts.
 *
 */
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
        $(this).slider({ min : 1, range : 'min', animate: true });
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
          var newPage;
          if (state.display == 'pages') {
            newPage = isNaN($(this).val()) ? 0 : parseInt($(this).val()) - 1;
            if (newPage < 0) {
              newPage = 0;
            } else if (newPage >= state.total) {
              newPage = state.total - 1;
            }
          } else {
            var item = isNaN($(this).val()) ? 0 : parseInt($(this).val()) - 1;
            if (item < 0) {
              item = 0;
            } else if (item >= state.total) {
              item = state.total - 1;
            }
            newPage = parseInt(item / parseInt(state.interval));
          }
          pagerer_relocate(state.root, state.path.replace(/pagererpage/, newPage));
          e.preventDefault();
          return false;
        case 38:    // up key
          pagerer_offset_widget_value(this, state, -1);
          return false;
        case 40:    // down key
          pagerer_offset_widget_value(this, state, 1);
          return false;
        case 33:    // page up
          pagerer_offset_widget_value(this, state, -5);
          return false;
        case 34:    // page down
          pagerer_offset_widget_value(this, state, 5);
          return false;
      }
    });

    // pagerer-slider event binding
    $('.pagerer-slider', context)
    .bind('slidecreate', function(e, ui) {
      var state = eval('(' + $(this).attr('id') + ');');
      var sliderBar = $(this);
      var sliderHandle = $(this).find(".ui-slider-handle")
      sliderHandle
        .width((String(state.total).length + 2) + 'em')
        .css('line-height', sliderHandle.height() + 'px')
        .css('margin-left', -sliderHandle.width() / 2)
        .bind('blur', function(e) {
          if ($(this).hasClass('being-spinned')) {
            return false;
          }
          var sliderBar = $(this).parent();
          var state = eval('(' + sliderBar.attr('id') + ');');
          sliderBar.slider("option", "value", state.current);
          $(this).text(state.current);
        });
      sliderBar
        .slider("option", "max", state.total)
        .slider("option", "value", state.current)
        .slider("option", "step", state.interval)
        .width((state.quantity * 3) + 'em')
        .css('margin-left', sliderHandle.width() / 2)
        .css('margin-right', sliderHandle.width() / 2);
    })
    .bind('slide', function(e, ui) {
      $(this).find(".ui-slider-handle").text(ui.value);
    })
    .bind('slidechange', function(e, ui) {
      var sliderHandle = $(this).find(".ui-slider-handle");
      sliderHandle.text(ui.value + ' ');
      if (sliderHandle.hasClass('pagerer-slider-set')) { 
        sliderHandle.append("<div class='pagerer-slider-handle-icon ui-icon ui-icon-check'/>");
        sliderHandle.find('.ui-icon-check')
          .bind('mousedown', function(e) {
            var sliderBar = $(this).parent().parent();
            var state = eval('(' + sliderBar.attr('id') + ');');
            var currVal = sliderBar.slider("option", "value");
            var newPage;
            if (state.display == 'pages') {
              newPage = currVal - 1;
            } else {
              newPage = parseInt(currVal / parseInt(state.interval));
            }
            pagerer_relocate(state.root, state.path.replace(/pagererpage/, newPage));
            return false;
          });
      } else {
        sliderHandle.addClass('pagerer-slider-set');
      }
    });

    // pagerer-slider control icons event binding
    var timeoutId = 0;
    var idleCycles = 0;
    $('.pagerer-slider-control-icon', context)
    .bind('mousedown', function(e) {
      var pSlider = $(this).parent().parent().find('.pagerer-slider');
      pSlider.find('.ui-slider-handle').addClass('being-spinned');
      var offset = $(this).hasClass('ui-icon-circle-minus') ? -1 : 1;
      pagerer_offset_slider_value(pSlider, offset);
      timeoutId = setInterval(function(){
        idleCycles++;
        if (idleCycles > 10) {
          pagerer_offset_slider_value(pSlider, offset);
        }
      }, 50);
    })
    .bind('mouseup mouseleave', function() {
      var pSlider = $(this).parent().parent().find('.pagerer-slider');
      pSlider.find('.ui-slider-handle').removeClass('being-spinned');
      idleCycles = 0;
      clearInterval(timeoutId);
      pSlider.find(".ui-slider-handle").focus();
    });


    // Helper functions
    
    /**
     * Relocates client browser to target page.
     */
    function pagerer_relocate(root, path) {
      if (window.Drupal.overlayChild) {
        // Drupal admin overlay
        window.parent.jQuery.bbq.pushState({'overlay': path});
      } else {
        // Normal page
        document.location = root + path;
      }
    };

    /**
     * Updates widget value.
     */
    function pagerer_offset_widget_value(widget, state, offset) {
      var widgetValue = isNaN($(widget).val()) ? 1 : parseInt($(widget).val());
      widgetValue += offset * state.interval;
      if (widgetValue < 1) {
        widgetValue = 1;
      } else if (widgetValue > state.total){
        widgetValue = state.total;
      }
      $(widget).val(widgetValue);
    };
    
    /**
     * Updates slider value.
     */
    function pagerer_offset_slider_value(ui, offset) {
      var step = ui.slider("option", "step");
      var newValue = ui.slider("option", "value") + (offset * step);
      var maxValue = ui.slider("option", "max");
      if (newValue > 0 && newValue <= maxValue) {
        ui.slider("option", "value", newValue);
      }
    }

  }
};
})(jQuery);