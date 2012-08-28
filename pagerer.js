/**
 * @file
 *
 * Pagerer jquery scripts.
 *
 */
(function ($) {

Drupal.behaviors.pagerer = {

  attach: function(context, settings) {

    /**
     * 'pagerer-page' input box event binding
     */

    $(".pagerer-page", context)
    .ready().each(function(index) {
      var state = eval('(' + $(this).attr('name') + ');');
      // Adjust width of the input box.
      $(this).width(String(state.total).length + 'em');
    })
    .bind('focus', function(event) {
      this.select();
      $(this).addClass('pagerer-page-has-focus');
    })
    .bind('blur', function(event) {
      $(this).removeClass('pagerer-page-has-focus');
    })
    .bind('keydown', function(event) {
      var state = eval('(' + $(this).attr('name') + ');');
      switch(event.keyCode) {
        case 13:
        case 10:
          // Return key pressed.
          var newPage;
          // Determine destination page.
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
          // Check if element is in Views AJAX context.
          var viewsAjaxContext = pagererInViewsAjaxContext(this);
          if (!viewsAjaxContext) {
            // Normally, relocate page.
            pagererRelocate(this, state.root, state.path.replace(/pagererpage/, newPage));
          } else {
            // If in Views AJAX instead, trigger ajax behaviour.
            pagererAttachViewsAjax(this, 'doViewsAjax', viewsAjaxContext, state.root, state.path.replace(/pagererpage/, newPage));
            $(this).trigger('doViewsAjax');
          }
          event.stopPropagation();
          event.preventDefault();
          return false;
        case 27:
          // Escape.
           $(this).val(state.current);
          return false;
        case 38:
          // Up.
          pagererOffsetWidgetValue(this, state, -1);
          return false;
        case 40:
          // Down.
          pagererOffsetWidgetValue(this, state, 1);
          return false;
        case 33:
          // Page up.
          pagererOffsetWidgetValue(this, state, -5);
          return false;
        case 34:
          // Page down.
          pagererOffsetWidgetValue(this, state, 5);
          return false;
        case 35:
          // End.
           $(this).val(state.total);
          return false;
        case 36:
          // Home.
           $(this).val(1);
          return false;
      }
    });

    /**
     * 'pagerer-slider' jQuery UI slider event binding.
     */

    $('.pagerer-slider', context)
    .ready().each(function(index) {
      var state = eval('(' + $(this).attr('id') + ');');

      // Create slider.
      var sliderBar = $(this);
      sliderBar.slider({ min : 1, range : 'min', animate: true });

      // Adjust slider handle width and current page.
      var sliderHandle = $(this).find(".ui-slider-handle")
      sliderHandle
        .width((String(state.total).length + 2) + 'em')
        .css('line-height', sliderHandle.height() + 'px')
        .css('margin-left', -sliderHandle.width() / 2)
        .text(state.current)
        .bind('blur', function(event) {
          if ($(this).hasClass('being-spinned')) {
            return false;
          }
          var sliderBar = $(this).parent();
          var state = eval('(' + sliderBar.attr('id') + ');');
          sliderBar.slider("option", "value", state.current);
          $(this).text(state.current);
        });

      // Adjust slider bar options and width.
      sliderBar
        .slider("option", "max", state.total)
        .slider("option", "value", state.current)
        .slider("option", "step", state.interval)
        .width((state.quantity * 3) + 'em')
        .css('margin-left', sliderHandle.width() / 2)
        .css('margin-right', sliderHandle.width() / 2);

    })
    .bind('slide', function(event, ui) {
      $(this).find(".ui-slider-handle").text(ui.value);
    })
    .bind('slidechange', function(event, ui) {

      // Add a tickmark to the handle, to be clicked to activate page relocation.
      var sliderHandle = $(this).find(".ui-slider-handle");
      sliderHandle
        .text(ui.value + ' ')
        .append("<div class='pagerer-slider-handle-icon ui-icon ui-icon-check'/>");
      var sliderHandleTickmark = sliderHandle.find('.ui-icon-check');

      // Check if we are in Views AJAX context.
      var viewsAjaxContext = pagererInViewsAjaxContext(this);

      if (!viewsAjaxContext) {
        // Normally, bind tickmark mousedown to page relocation.
        sliderHandleTickmark.bind('mousedown', function(event) {
            var sliderBar = $(this).parent().parent();
            var state = eval('(' + sliderBar.attr('id') + ');');
            var currVal = sliderBar.slider("option", "value");
            var newPage;
            if (state.display == 'pages') {
              newPage = currVal - 1;
            } else {
              newPage = parseInt(currVal / parseInt(state.interval));
            }
            pagererRelocate(this, state.root, state.path.replace(/pagererpage/, newPage));
            return false;
        });
      }
      else {
        // If in Views AJAX instead, bind tickmark mousedown to ajax behaviour.
        var sliderBar = $(this);
        var state = eval('(' + sliderBar.attr('id') + ');');
        var currVal = sliderBar.slider("option", "value");
        var newPage;
        if (state.display == 'pages') {
          newPage = currVal - 1;
        } else {
          newPage = parseInt(currVal / parseInt(state.interval));
        }
        pagererAttachViewsAjax(sliderHandleTickmark, 'mousedown', viewsAjaxContext, state.root, state.path.replace(/pagererpage/, newPage));
      }
    });

    // pagerer-slider control icons event binding
    var timeoutId = 0;
    var idleCycles = 0;
    // Spinners events.
    $('.pagerer-slider-control-icon', context)
    .bind('mousedown', function(event) {
      var pSlider = $(this).parent().parent().find('.pagerer-slider');
      pSlider.find('.ui-slider-handle').addClass('being-spinned');
      var offset = $(this).hasClass('ui-icon-circle-minus') ? -1 : 1;
      pagererOffsetSliderValue(pSlider, offset);
      timeoutId = setInterval(function(){
        idleCycles++;
        if (idleCycles > 10) {
          pagererOffsetSliderValue(pSlider, offset);
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


    /**
     * Helper functions
     */

    /**
     * Relocate client browser to target page.
     *
     * Relocation method is decided based on the context of the pager,
     * being in order of priority:
     *  - a Views preview area in a Views settings form - AJAX is used
     *  - a page rendered through the admin overlay - BBQ is used
     *  - a normal page - document.location is used
     */
    function pagererRelocate(element, root, path) {
      if ($(element).parents('#views-live-preview').length) {
        // Element is in Views preview context.
        var base = $(element).attr('id');
        var element_settings = {
          'event': 'click',
          'progress': { 'type': 'throbber' },
          'url': root + path,
          'method': 'html',
          'wrapper': 'views-live-preview',
        };
        Drupal.ajax[base] = new Drupal.ajax(base, element, element_settings);
        $(element).trigger('click');
      } else if (window.Drupal.overlayChild) {
        // Drupal admin overlay
        window.parent.jQuery.bbq.pushState({'overlay': path});
      } else {
        // Normal page
        document.location = root + path;
      }
    };

    /**
     * Update widget value.
     */
    function pagererOffsetWidgetValue(widget, state, offset) {
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
     * Update slider value.
     */
    function pagererOffsetSliderValue(ui, offset) {
      var step = ui.slider("option", "step");
      var newValue = ui.slider("option", "value") + (offset * step);
      var maxValue = ui.slider("option", "max");
      if (newValue > 0 && newValue <= maxValue) {
        ui.slider("option", "value", newValue);
      }
    }

    /**
     * Views - Check if element is part of an AJAX enabled view.
     */
    function pagererInViewsAjaxContext(element) {
      if (Drupal.settings && Drupal.settings.views && Drupal.settings.views.ajaxViews) {
        // Loop through active Views Ajax elements.
        for (var i in Drupal.settings.views.ajaxViews) {
          var view = '.view-dom-id-' + Drupal.settings.views.ajaxViews[i].view_dom_id;
          var viewDiv = $(element).parents(view);
          if (viewDiv.size()) {
            return {
              target: viewDiv.get(0),
              settings: Drupal.settings.views.ajaxViews[i],
              selector: view
            };
          }
        }
      }
      return false;
    }

    /**
     * Views - Attach Views AJAX behaviour to an element.
     */
    function pagererAttachViewsAjax(element, event, viewContext, root, path) {

      // Link to the element.
      var $link = $(element);

      // Retrieve the path to use for views' ajax.
      var ajax_path = Drupal.settings.views.ajax_path;

      // If there are multiple views this might've ended up showing up multiple times.
      if (ajax_path.constructor.toString().indexOf("Array") != -1) {
        ajax_path = ajax_path[0];
      }

      // Check if there are any GET parameters to send to views.
      var queryString = window.location.search || '';
      if (queryString !== '') {
        // Remove the question mark and Drupal path component if any.
        var queryString = queryString.slice(1).replace(/q=[^&]+&?|&?render=[^&]+/, '');
        if (queryString !== '') {
          // If there is a '?' in ajax_path, clean url are on and & should be used to add parameters.
          queryString = ((/\?/.test(ajax_path)) ? '&' : '?') + queryString;
        }
      }

      // Load view's settings and parse pagerer root/path.
      var viewData = {};
      $.extend(
        viewData,
        viewContext.settings,
        Drupal.Views.parseQueryString(root + path),
        Drupal.Views.parseViewArgs(root + path, viewContext.settings.view_base_path)
      );

      // Load AJAX element_settings object and attach AJAX behaviour.
      var elementAjaxSettings = {
        url: ajax_path + queryString,
        submit: viewData,
        setClick: true,
        event: event,
        selector: viewContext.selector,
        progress: { type: 'throbber' }
      };
      viewContext.pagerAjax = new Drupal.ajax(false, $link, elementAjaxSettings);
    }

  }
};
})(jQuery);
